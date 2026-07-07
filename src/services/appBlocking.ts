import { NativeModules, Platform } from "react-native";
import { labelForPackage } from "@/constants/blockedAppPackages";
import type { TempUnlockRow } from "@/constants/appUnlock";
import { deviceUnlockUntilMs, effectiveUnlockEndMs, isUnlockActive } from "@/utils/appUnlockTime";
import { effectiveBlockedPackagesForNative } from "@/utils/nativeBlockPolicy";
import { packagesForUnlockKey, unlockPricingKey } from "@/utils/appUnlockPackages";

type TempAllowNativeEntry = { package_name: string; unlock_until_ms: number; app_label?: string };

type NativeBlocker = {
  setBlockedPackages: (packages: string[]) => Promise<void>;
  setTemporaryAllows: (entries: TempAllowNativeEntry[]) => Promise<void>;
  applyBlockPolicy?: (packages: string[], allows: TempAllowNativeEntry[]) => Promise<void>;
  mergeTemporaryAllow: (packageName: string, untilMs: number, appLabel?: string | null) => Promise<boolean>;
  isPackageTempAllowed?: (packageName: string) => Promise<boolean>;
  clearBlockedPackages: () => Promise<void>;
  isAccessibilityEnabled: () => Promise<boolean>;
  openAccessibilitySettings: () => void;
  consumePendingBlockedPackage: () => Promise<string | null>;
  launchAppPackage: (packageName: string) => Promise<boolean>;
  launchUnlockedApp?: (packageName: string, untilMs: number, appLabel?: string | null) => Promise<boolean>;
};

const native: NativeBlocker | undefined = NativeModules.LearnGateBlocker;

export function isAppBlockingAvailable(): boolean {
  return Platform.OS === "android" && native != null;
}

export async function syncBlockedPackages(packages: string[]): Promise<void> {
  if (!native) return;
  await native.setBlockedPackages(packages);
}

/**
 * Sync parent block rules + active star unlocks to native.
 *
 * The device enforcement list EXCLUDES apps that currently have an active temp unlock, so an
 * unlocked app is physically absent from the blocked list and can never be bounced back to
 * LearnGate while time remains. The temp-allow list is still sent so the native side knows the
 * countdown/label and, when a pass expires, its scheduler re-blocks the app instantly (see
 * enforceExpiry in the accessibility service) — no extra JS sync required.
 */
export async function syncNativeChildBlockPolicy(
  blockedPackages: string[],
  tempUnlocks: TempUnlockRow[],
  options?: { allowEmptyAllows?: boolean }
): Promise<void> {
  if (!native) return;
  const now = Date.now();
  const enforced = effectiveBlockedPackagesForNative(blockedPackages, tempUnlocks, now);
  // Only started (activated) passes become device allows; a granted-but-not-opened pass must not
  // let the app through yet.
  const activeRows = tempUnlocks.filter((row) => isUnlockActive(row, now));
  const allows = expandUnlockRowsForNative(activeRows)
    .map((row) => rowToNativePayload(row, now))
    .filter((e) => e.unlock_until_ms > now);

  // Atomic path: allows committed together with the (already-filtered) block list.
  if (native.applyBlockPolicy) {
    try {
      await native.applyBlockPolicy(enforced, allows);
      return;
    } catch (e) {
      if (__DEV__) console.warn("[LearnGate] applyBlockPolicy failed, falling back:", e);
      // fall through to the two-step path below
    }
  }

  // Fallback (older native builds, or if the atomic call errored): write allows first.
  if (allows.length > 0 || options?.allowEmptyAllows) {
    await native.setTemporaryAllows(allows);
  }
  await native.setBlockedPackages(enforced);
}

function rowToNativePayload(row: TempUnlockRow, nowMs = Date.now()) {
  return {
    package_name: row.package_name,
    unlock_until_ms: effectiveUnlockEndMs(row, nowMs),
    app_label: labelForPackage(row.package_name),
  };
}

export async function syncTemporaryAllows(
  rows: TempUnlockRow[],
  options?: { allowEmpty?: boolean }
): Promise<void> {
  if (!native) return;
  const now = Date.now();
  const expanded = expandUnlockRowsForNative(rows);
  const payload = expanded.map((row) => rowToNativePayload(row, now)).filter((e) => e.unlock_until_ms > now);
  if (payload.length === 0 && !options?.allowEmpty) {
    return;
  }
  await native.setTemporaryAllows(payload);
}

function expandUnlockRowsForNative(rows: TempUnlockRow[]): TempUnlockRow[] {
  const out: TempUnlockRow[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const pkgs = packagesForUnlockKey(unlockPricingKey(row.package_name));
    for (const package_name of pkgs) {
      if (seen.has(package_name)) continue;
      seen.add(package_name);
      out.push({ ...row, package_name });
    }
  }
  return out;
}

/** Merge one unlock into native prefs (synchronous commit on device) — use right before launching the app. */
export async function mergeTemporaryAllowForPackage(
  row: TempUnlockRow,
  allRows?: TempUnlockRow[],
  untilMsOverride?: number
): Promise<void> {
  const untilMs = untilMsOverride ?? effectiveUnlockEndMs(row);
  if (untilMs <= Date.now()) return;

  if (native?.mergeTemporaryAllow) {
    await native.mergeTemporaryAllow(row.package_name, untilMs, labelForPackage(row.package_name));
    return;
  }

  if (allRows?.length) {
    await syncTemporaryAllows(allRows);
    return;
  }

  await syncTemporaryAllows([row]);
}

/** Apply temp allow for every package in the blocked-app group (e.g. all TikTok package names). */
export async function mergeUnlockRowToNative(row: TempUnlockRow, allRows?: TempUnlockRow[]): Promise<void> {
  const untilMs = effectiveUnlockEndMs(row);
  if (untilMs <= Date.now()) return;
  const pkgs = packagesForUnlockKey(unlockPricingKey(row.package_name));
  for (const package_name of pkgs) {
    await mergeTemporaryAllowForPackage({ ...row, package_name }, allRows ?? [row]);
  }
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

/** Open a blocked app when a temp unlock is active (returns false if no launcher intent). */
export async function launchAppPackage(
  packageName: string,
  unlock?: TempUnlockRow | null,
  _blockedPackages?: string[]
): Promise<boolean> {
  if (!native) return false;
  if (unlock) {
    // Device-clock-relative end time: on emulators/phones whose clock drifts from the server, a
    // server-derived end time can look already-expired and skip the allow entirely. Counting from
    // the device clock here guarantees the just-opened app is allowed for its full duration.
    const untilMs = deviceUnlockUntilMs(unlock);
    if (untilMs > Date.now()) {
      // Guarantee the exact package we're about to open is allowed (synchronous native commit),
      // then hand off to launchUnlockedApp which arms the countdown overlay.
      await mergeTemporaryAllowForPackage({ ...unlock, package_name: packageName }, undefined, untilMs);
      if (native.launchUnlockedApp) {
        return native.launchUnlockedApp(packageName, untilMs, labelForPackage(packageName));
      }
    }
  }
  return native.launchAppPackage(packageName);
}
