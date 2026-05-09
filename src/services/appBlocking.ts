import { NativeModules, Platform } from "react-native";

type NativeBlocker = {
  setBlockedPackages: (packages: string[]) => Promise<void>;
  clearBlockedPackages: () => Promise<void>;
  isAccessibilityEnabled: () => Promise<boolean>;
  openAccessibilitySettings: () => void;
  consumePendingBlockedPackage: () => Promise<string | null>;
};

const native: NativeBlocker | undefined = NativeModules.LearnGateBlocker;

export function isAppBlockingAvailable(): boolean {
  return Platform.OS === "android" && native != null;
}

export async function syncBlockedPackages(packages: string[]): Promise<void> {
  if (!native) return;
  await native.setBlockedPackages(packages);
}

export async function clearBlockedPackagesFromNative(): Promise<void> {
  if (!native) return;
  await native.clearBlockedPackages();
}

export async function getAccessibilityEnabled(): Promise<boolean> {
  if (!native) return false;
  return native.isAccessibilityEnabled();
}

export function openAccessibilitySettings(): void {
  native?.openAccessibilitySettings();
}

/** When the accessibility service bounced the user back, returns the blocked package once. */
export async function consumePendingBlockedPackage(): Promise<string | null> {
  if (!native) return null;
  return native.consumePendingBlockedPackage();
}
