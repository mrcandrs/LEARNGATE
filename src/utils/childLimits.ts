export const DAILY_LIMIT_MIN_MINUTES = 1;
export const DAILY_LIMIT_MAX_MINUTES = 1440;

/** Display/storage for time inputs (HH:mm). */
export function formatBedtimeForInput(value: string): string {
  const trimmed = value.trim();
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed.slice(0, 5);
  }
  return trimmed;
}

export type BedtimeValidation = { value: string | null; error: string | null };

/** Valid clock times: 00:00 through 23:59 (hours 00–23 only). */
export function validateBedtimeForDb(value: string): BedtimeValidation {
  const trimmed = formatBedtimeForInput(value);
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return { value: null, error: "Use HH:mm between 00:00 and 23:59 (example: 20:00)." };
  }
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (hours < 0 || hours > 23) {
    return { value: null, error: "Hour must be between 00 and 23." };
  }
  if (minutes < 0 || minutes > 59) {
    return { value: null, error: "Minutes must be between 00 and 59." };
  }
  const normalized = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
  return { value: normalized, error: null };
}

/** @deprecated Use validateBedtimeForDb */
export function normalizeBedtimeForDb(value: string): string | null {
  return validateBedtimeForDb(value).value;
}

export function parseDailyLimitMinutes(raw: string): { value: number | null; error: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { value: null, error: "Daily limit is required." };
  }
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(n)) {
    return { value: null, error: "Please enter a valid daily limit (minutes)." };
  }
  if (n < DAILY_LIMIT_MIN_MINUTES || n > DAILY_LIMIT_MAX_MINUTES) {
    return {
      value: null,
      error: `Daily limit must be between ${DAILY_LIMIT_MIN_MINUTES} and ${DAILY_LIMIT_MAX_MINUTES} minutes.`,
    };
  }
  return { value: n, error: null };
}

export function formatDailyLimitDbError(raw: string): string | null {
  if (raw.includes("children_daily_limit_minutes_check")) {
    return `Daily limit must be between ${DAILY_LIMIT_MIN_MINUTES} and ${DAILY_LIMIT_MAX_MINUTES} minutes. If testing with 1 min, run supabase/step-v-daily-limit-min-1.sql in Supabase.`;
  }
  return null;
}
