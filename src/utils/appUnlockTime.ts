import type { TempUnlockRow, UnlockDuration } from "@/constants/appUnlock";
import { blockedAppsForDisplay } from "@/constants/blockedAppPackages";
import { packagesForUnlockKey, unlockPricingKey } from "@/utils/appUnlockPackages";

const DURATION_MS: Record<UnlockDuration, number> = {
  "30m": 30 * 60 * 1000,
  rest_of_day: 0,
  week: 0,
};

/** End timestamp for a temp-unlock row (prefers started_at + duration for 30m passes). */
export function effectiveUnlockEndMs(row: TempUnlockRow, nowMs = Date.now()): number {
  const untilMs = new Date(row.unlock_until).getTime();

  if (row.duration === "30m") {
    if (row.started_at) {
      const fromStart = new Date(row.started_at).getTime() + DURATION_MS["30m"];
      return Math.min(fromStart, untilMs);
    }
    const remaining = untilMs - nowMs;
    if (remaining > 0 && remaining <= DURATION_MS["30m"] + 5 * 60 * 1000) {
      return untilMs;
    }
  }

  return untilMs;
}

export function msUntilUnlockEnd(row: TempUnlockRow | string, nowMs = Date.now()): number {
  const endMs = typeof row === "string" ? new Date(row).getTime() : effectiveUnlockEndMs(row, nowMs);
  return Math.max(0, endMs - nowMs);
}

export function formatUnlockRemaining(row: TempUnlockRow | string, nowMs = Date.now()): string {
  const ms = msUntilUnlockEnd(row, nowMs);
  if (ms <= 0) {
    return "Expired";
  }
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}h ${m}m left`;
  }
  if (m > 0) {
    return `${m}m ${s}s left`;
  }
  return `${s}s left`;
}

export function unlockRowForPackage(packageName: string, tempUnlocks: TempUnlockRow[]): TempUnlockRow | null {
  const pkgs = new Set([...packagesForUnlockKey(unlockPricingKey(packageName)), packageName]);
  let best: TempUnlockRow | null = null;
  let bestEnd = 0;
  const now = Date.now();

  for (const row of tempUnlocks) {
    if (!pkgs.has(row.package_name)) {
      continue;
    }
    const end = effectiveUnlockEndMs(row, now);
    if (end > now && end > bestEnd) {
      bestEnd = end;
      best = row;
    }
  }

  return best;
}

export function unlockUntilForPackage(packageName: string, tempUnlocks: TempUnlockRow[]): string | null {
  const row = unlockRowForPackage(packageName, tempUnlocks);
  if (!row) {
    return null;
  }
  const endMs = effectiveUnlockEndMs(row);
  return endMs > Date.now() ? new Date(endMs).toISOString() : null;
}

export type ActiveUnlockDisplay = {
  key: string;
  label: string;
  icon: import("@/constants/blockedAppPackages").BlockableIconName;
  unlock_until: string;
  duration?: UnlockDuration | null;
  started_at?: string | null;
};

/** Group temp unlocks by blocked-app tile (TikTok group, etc.). */
export function activeUnlocksForDisplay(
  blockedPackages: string[],
  tempUnlocks: TempUnlockRow[]
): ActiveUnlockDisplay[] {
  const now = Date.now();
  const items = blockedAppsForDisplay(blockedPackages);
  const result: ActiveUnlockDisplay[] = [];

  for (const app of items) {
    const pkgs = packagesForUnlockKey(app.key);
    let bestRow: TempUnlockRow | null = null;
    let bestEnd = 0;

    for (const row of tempUnlocks) {
      if (!pkgs.includes(row.package_name)) continue;
      const end = effectiveUnlockEndMs(row, now);
      if (end > now && end > bestEnd) {
        bestEnd = end;
        bestRow = row;
      }
    }

    if (bestRow) {
      result.push({
        key: app.key,
        label: app.label,
        icon: app.icon,
        unlock_until: new Date(bestEnd).toISOString(),
        duration: bestRow.duration,
        started_at: bestRow.started_at,
      });
    }
  }

  return result.sort((a, b) => a.label.localeCompare(b.label));
}
