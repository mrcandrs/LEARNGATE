import { BLOCKABLE_APP_GROUPS } from "@/constants/blockedAppPackages";
import type { TempUnlockRow } from "@/constants/appUnlock";
import { isUnlockActive } from "@/utils/appUnlockTime";
import { packagesForUnlockKey, unlockPricingKey } from "@/utils/appUnlockPackages";

/** Expand group slugs (e.g. "youtube") and curated tiles to real Android package names. */
export function expandBlockedPackagesForNative(blockedPackages: string[]): string[] {
  const out = new Set<string>();
  for (const entry of blockedPackages) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const group = BLOCKABLE_APP_GROUPS.find((g) => g.slug === trimmed);
    if (group) {
      for (const pkg of group.packages) {
        out.add(pkg);
      }
      continue;
    }
    out.add(trimmed);
  }
  return [...out];
}

/** Packages that should be enforced on-device right now (parent block list minus active star unlocks). */
export function effectiveBlockedPackagesForNative(
  blockedPackages: string[],
  tempUnlocks: TempUnlockRow[],
  nowMs = Date.now()
): string[] {
  const blocked = new Set(expandBlockedPackagesForNative(blockedPackages));

  for (const row of tempUnlocks) {
    // Only a STARTED (activated) pass grants an exception. Granted-but-not-opened passes stay
    // blocked until the child opens the app (which starts the clock).
    if (!isUnlockActive(row, nowMs)) {
      continue;
    }
    for (const pkg of packagesForUnlockKey(unlockPricingKey(row.package_name))) {
      blocked.delete(pkg);
    }
  }

  return [...blocked];
}
