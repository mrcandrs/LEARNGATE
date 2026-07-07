import type { TempUnlockRow, UnlockDuration } from "@/constants/appUnlock";
import { blockedAppsForDisplay } from "@/constants/blockedAppPackages";
import { packagesForUnlockKey, unlockPricingKey } from "@/utils/appUnlockPackages";

const DURATION_MS: Record<UnlockDuration, number> = {
  "1m": 60 * 1000,
  "5m": 5 * 60 * 1000,
  "30m": 30 * 60 * 1000,
  rest_of_day: 0,
  week: 0,
};

/** Durations that are a fixed length from the moment they start (vs. anchored to midnight/week). */
const FIXED_LENGTH_DURATIONS: UnlockDuration[] = ["1m", "5m", "30m"];

/** End timestamp for a temp-unlock row (prefers started_at + duration for fixed-length passes). */
export function effectiveUnlockEndMs(row: TempUnlockRow, nowMs = Date.now()): number {
  const untilMs = new Date(row.unlock_until).getTime();

  if (row.duration && FIXED_LENGTH_DURATIONS.includes(row.duration)) {
    const lengthMs = DURATION_MS[row.duration];
    if (row.started_at) {
      const fromStart = new Date(row.started_at).getTime() + lengthMs;
      return Math.min(fromStart, untilMs);
    }
    const remaining = untilMs - nowMs;
    if (remaining > 0 && remaining <= lengthMs + 5 * 60 * 1000) {
      return untilMs;
    }
  }

  return untilMs;
}

/**
 * End timestamp to hand to the DEVICE (native allow + overlay), measured against the device clock.
 *
 * Emulators (MuMu, BlueStacks, etc.) and some phones have a wall clock that drifts from the server.
 * Because the native side compares this value against `System.currentTimeMillis()`, deriving it from
 * a server timestamp (`started_at`) can make a just-started pass look already-expired on a skewed
 * clock — no allow gets written, no overlay shows, and the app bounces. For fixed-length passes we
 * therefore count purely from the device clock at open time, which is immune to any skew.
 */
export function deviceUnlockUntilMs(row: TempUnlockRow, nowMs = Date.now()): number {
  if (row.duration && FIXED_LENGTH_DURATIONS.includes(row.duration)) {
    return nowMs + DURATION_MS[row.duration];
  }
  return effectiveUnlockEndMs(row, nowMs);
}

/**
 * A pass is enforceable-active only once its clock has started (activated_at set) and it hasn't
 * ended. Fixed passes (1m/5m/30m) start on first open; anchored passes start at approval.
 */
export function isUnlockActive(row: TempUnlockRow, nowMs = Date.now()): boolean {
  if (!row.activated_at) {
    return false;
  }
  return effectiveUnlockEndMs(row, nowMs) > nowMs;
}

/** True when a pass has been granted but the child hasn't opened the app to start it yet. */
export function isUnlockGrantedNotStarted(row: TempUnlockRow, nowMs = Date.now()): boolean {
  return !row.activated_at && new Date(row.unlock_until).getTime() > nowMs;
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
  activated_at?: string | null;
  /** false = granted but not opened yet (countdown hasn't started). */
  activated: boolean;
};

/** Group temp unlocks by blocked-app tile (TikTok group, etc.). Includes not-yet-started passes. */
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
      // Openable = either active (started, not ended) or granted-and-waiting-to-start.
      const openable = isUnlockActive(row, now) || isUnlockGrantedNotStarted(row, now);
      if (!openable) continue;
      const end = effectiveUnlockEndMs(row, now);
      if (end > bestEnd) {
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
        activated_at: bestRow.activated_at,
        activated: Boolean(bestRow.activated_at),
      });
    }
  }

  return result.sort((a, b) => a.label.localeCompare(b.label));
}
