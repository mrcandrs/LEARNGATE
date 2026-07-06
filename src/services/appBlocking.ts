import { NativeModules, Platform } from "react-native";
import { labelForPackage } from "@/constants/blockedAppPackages";
import type { TempUnlockRow } from "@/constants/appUnlock";
import { effectiveUnlockEndMs } from "@/utils/appUnlockTime";
import { effectiveBlockedPackagesForNative } from "@/utils/nativeBlockPolicy";
import { packagesForUnlockKey, unlockPricingKey } from "@/utils/appUnlockPackages";

type NativeBlocker = {
  setBlockedPackages: (packages: string[]) => Promise<void>;
  setTemporaryAllows: (entries: { package_name: string; unlock_until_ms: number; app_label?: string }[]) => Promise<void>;
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

/** Sync parent block rules + active star unlocks to native (single source of truth on device). */
export async function syncNativeChildBlockPolicy(
  blockedPackages: string[],
  tempUnlocks: TempUnlockRow[],
  options?: { allowEmptyAllows?: boolean }
): Promise<void> {
  if (!native) return;
  const now = Date.now();
  const enforced = effectiveBlockedPackagesForNative(blockedPackages, tempUnlocks, now);
  await native.setBlockedPackages(enforced);
  await syncTemporaryAllows(tempUnlocks, { allowEmpty: options?.allowEmptyAllows });
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
  allRows?: TempUnlockRow[]
): Promise<void> {
  const untilMs = effectiveUnlockEndMs(row);
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
  blockedPackages?: string[]
): Promise<boolean> {
  if (!native) return false;
  if (unlock) {
    const untilMs = effectiveUnlockEndMs(unlock);
    if (untilMs > Date.now()) {
      if (blockedPackages) {
        await syncNativeChildBlockPolicy(blockedPackages, [unlock]);
      } else {
        await mergeTemporaryAllowForPackage({ ...unlock, package_name: packageName });
      }
      if (native.launchUnlockedApp) {
        return native.launchUnlockedApp(packageName, untilMs, labelForPackage(packageName));
      }
    }
  }
  return native.launchAppPackage(packageName);
}
