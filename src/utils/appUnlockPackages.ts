import { BLOCKABLE_APP_GROUPS } from "@/constants/blockedAppPackages";
import type { UnlockPricingEntry } from "@/constants/appUnlock";

/** Map package → pricing key (group slug or raw package). */
export function unlockPricingKey(packageName: string): string {
  for (const group of BLOCKABLE_APP_GROUPS) {
    if ((group.packages as readonly string[]).includes(packageName)) {
      return group.slug;
    }
  }
  return packageName;
}

/** All Android packages covered by a pricing key. */
export function packagesForUnlockKey(key: string): string[] {
  const group = BLOCKABLE_APP_GROUPS.find((g) => g.slug === key);
  return group ? [...group.packages] : [key];
}

export function pricingEntryForPackage(
  packageName: string,
  pricingJson: Record<string, UnlockPricingEntry> | null | undefined
): UnlockPricingEntry {
  const key = unlockPricingKey(packageName);
  return pricingJson?.[key] ?? pricingJson?.[packageName] ?? { mode: "suggested" };
}

export function pricingModeLabel(mode: UnlockPricingEntry["mode"]): string {
  switch (mode) {
    case "fixed":
      return "Fixed stars";
    case "disabled":
      return "Not redeemable";
    default:
      return "Suggested (usage-based)";
  }
}
