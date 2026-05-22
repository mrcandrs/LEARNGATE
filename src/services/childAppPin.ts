import { AppState, NativeModules, Platform } from "react-native";

type NativeChildLock = {
  setScreenLocked: (locked: boolean) => Promise<boolean>;
  startKiosk: () => Promise<boolean>;
  stopKiosk: () => Promise<boolean>;
  isInLockTask: () => Promise<boolean>;
};

const native: NativeChildLock | undefined = NativeModules.LearnGateChildLock;

let navVisibilitySub: { remove: () => void } | null = null;
let reapplyTimer: ReturnType<typeof setInterval> | null = null;
let appStateSub: { remove: () => void } | null = null;

async function hideAndroidNavBar(): Promise<void> {
  const NavigationBar = await import("expo-navigation-bar");
  await NavigationBar.setVisibilityAsync("hidden");
  await NavigationBar.setBehaviorAsync("overlay-swipe");
  await NavigationBar.setPositionAsync("absolute");
}

async function showAndroidNavBar(): Promise<void> {
  const NavigationBar = await import("expo-navigation-bar");
  await NavigationBar.setVisibilityAsync("visible");
  await NavigationBar.setBehaviorAsync("inset-swipe");
  await NavigationBar.setPositionAsync("relative");
}

function clearNavListeners(): void {
  navVisibilitySub?.remove();
  navVisibilitySub = null;
  if (reapplyTimer) {
    clearInterval(reapplyTimer);
    reapplyTimer = null;
  }
  appStateSub?.remove();
  appStateSub = null;
}

async function applyAndroidChildLock(): Promise<void> {
  try {
    await native?.setScreenLocked(true);
  } catch {
    // Native module missing until dev build with withLearnGateNative
  }

  try {
    await native?.startKiosk();
  } catch {
    // Lock task may be denied on some devices; accessibility still enforces return.
  }

  try {
    await hideAndroidNavBar();
    const NavigationBar = await import("expo-navigation-bar");
    navVisibilitySub = NavigationBar.addVisibilityListener(({ visibility }) => {
      if (visibility === "visible") {
        void hideAndroidNavBar();
        void native?.startKiosk();
      }
    });
  } catch {
    // expo-navigation-bar optional
  }

  if (!reapplyTimer) {
    reapplyTimer = setInterval(() => {
      void hideAndroidNavBar();
      void native?.startKiosk();
    }, 2000);
  }

  if (!appStateSub) {
    appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void applyAndroidChildLock();
      }
    });
  }
}

async function releaseAndroidChildLock(): Promise<void> {
  clearNavListeners();

  try {
    await native?.setScreenLocked(false);
  } catch {
    // ignore
  }

  try {
    await native?.stopKiosk();
  } catch {
    // ignore
  }

  try {
    await showAndroidNavBar();
  } catch {
    // ignore
  }
}

/**
 * Android kiosk layer while LearnGate child lock is active:
 * - Lock Task + immersive mode (blocks Home/Recents when the OS allows)
 * - Re-hide navigation bar if the child swipes it back (3-button nav)
 * - Accessibility flag so LearnGateAccessibilityService pulls user back from launcher/other apps
 *
 * Requires a dev build (`npm run android`), not Expo Go. Parent should enable
 * Settings → Accessibility → LearnGate on the child device.
 */
export async function setChildSystemNavLocked(locked: boolean): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }
  if (locked) {
    await applyAndroidChildLock();
  } else {
    await releaseAndroidChildLock();
  }
}

export function isChildKioskNativeAvailable(): boolean {
  return Platform.OS === "android" && native != null;
}
