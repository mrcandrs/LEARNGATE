import AsyncStorage from "@react-native-async-storage/async-storage";
import { birthdayIsoFromParts, manilaToday } from "@/utils/childBirthday";

const STORAGE_PREFIX = "learngate_child_screen_usage_v3";

export type ScreenLimitSnapshot = {
  limitSetAt: string | null | undefined;
  dailyLimitMinutes: number;
  screenLimitEnabled: boolean;
  /** When counting may begin — parent save time (server or detected limit change). */
  effectiveEpochMs: number | null;
};

type UsageRecord = {
  date: string;
  epochMs: number;
  accumulatedMs: number;
};

/** Calendar day for screen limits follows Asia/Manila (same as star reset / birthday). */
export function todayDateKey(now = new Date()): string {
  const t = manilaToday(now);
  return birthdayIsoFromParts(t.year, t.month, t.day);
}

export function parseLimitEpochMs(limitSetAt: string | null | undefined): number | null {
  if (!limitSetAt) {
    return null;
  }
  const ms = Date.parse(limitSetAt);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Counting only starts once the parent has saved a limit.
 * Prefer server `screen_limit_set_at`; fall back to "now" when limit toggles change without that column.
 */
export function resolveEffectiveEpochMs(
  snapshot: Omit<ScreenLimitSnapshot, "effectiveEpochMs">,
  prev: ScreenLimitSnapshot | null,
  nowMs: number
): number | null {
  if (!snapshot.screenLimitEnabled) {
    return null;
  }

  const serverEpoch = parseLimitEpochMs(snapshot.limitSetAt);
  if (serverEpoch != null) {
    return serverEpoch;
  }

  if (
    prev &&
    (prev.dailyLimitMinutes !== snapshot.dailyLimitMinutes ||
      prev.screenLimitEnabled !== snapshot.screenLimitEnabled)
  ) {
    return nowMs;
  }

  return prev?.effectiveEpochMs ?? null;
}

export function buildSnapshot(
  child: {
    screen_limit_set_at?: string | null;
    daily_limit_minutes: number;
    screen_limit_enabled?: boolean;
  },
  prev: ScreenLimitSnapshot | null,
  nowMs = Date.now()
): ScreenLimitSnapshot {
  const base = {
    limitSetAt: child.screen_limit_set_at ?? null,
    dailyLimitMinutes: child.daily_limit_minutes,
    screenLimitEnabled: child.screen_limit_enabled !== false,
  };
  return {
    ...base,
    effectiveEpochMs: resolveEffectiveEpochMs(base, prev, nowMs),
  };
}

export function canTrackScreenTime(snapshot: ScreenLimitSnapshot | null): boolean {
  return Boolean(snapshot?.screenLimitEnabled && snapshot.effectiveEpochMs != null);
}

/** Session timer must not include any time before the parent-save epoch. */
export function sessionStartAfterEpoch(nowMs: number, epochMs: number): number {
  return Math.max(nowMs, epochMs);
}

export function countableElapsedMs(sessionStartMs: number, nowMs: number, epochMs: number): number {
  const from = Math.max(sessionStartMs, epochMs);
  if (nowMs <= from) {
    return 0;
  }
  return nowMs - from;
}

function storageKey(childId: string): string {
  return `${STORAGE_PREFIX}:${childId}`;
}

function normalizeMinutes(ms: number): number {
  return Math.max(0, Math.round((ms / 60_000) * 10) / 10);
}

async function readRecord(childId: string): Promise<UsageRecord | null> {
  const raw = await AsyncStorage.getItem(storageKey(childId));
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as UsageRecord;
  } catch {
    return null;
  }
}

export async function getTodayUsageMinutes(
  childId: string,
  epochMs: number | null
): Promise<number> {
  if (epochMs == null) {
    return 0;
  }
  const record = await readRecord(childId);
  const today = todayDateKey();
  if (!record || record.date !== today || record.epochMs !== epochMs) {
    return 0;
  }
  return normalizeMinutes(record.accumulatedMs);
}

export async function resetUsageForEpoch(childId: string, epochMs: number): Promise<void> {
  const record: UsageRecord = {
    date: todayDateKey(),
    epochMs,
    accumulatedMs: 0,
  };
  await AsyncStorage.setItem(storageKey(childId), JSON.stringify(record));
}

export async function addCountableMs(
  childId: string,
  epochMs: number,
  deltaMs: number
): Promise<number> {
  if (deltaMs < 1000 || epochMs == null) {
    return getTodayUsageMinutes(childId, epochMs);
  }

  const today = todayDateKey();
  const record = await readRecord(childId);
  let accumulatedMs = 0;

  if (record && record.date === today && record.epochMs === epochMs) {
    accumulatedMs = record.accumulatedMs;
  }

  accumulatedMs += deltaMs;

  await AsyncStorage.setItem(
    storageKey(childId),
    JSON.stringify({ date: today, epochMs, accumulatedMs } satisfies UsageRecord)
  );

  return normalizeMinutes(accumulatedMs);
}

export function minutesIncludingSession(
  storedMinutes: number,
  sessionStartMs: number | null,
  epochMs: number | null,
  nowMs = Date.now()
): number {
  if (epochMs == null || sessionStartMs == null) {
    return storedMinutes;
  }
  const inFlightMs = countableElapsedMs(sessionStartMs, nowMs, epochMs);
  return normalizeMinutes(storedMinutes * 60_000 + inFlightMs);
}
