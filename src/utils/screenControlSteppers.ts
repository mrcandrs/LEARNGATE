import { DAILY_LIMIT_MAX_MINUTES, DAILY_LIMIT_MIN_MINUTES } from "@/utils/childLimits";

const BEDTIME_STEP_MINUTES = 15;
const DAILY_LIMIT_STEP_MINUTES = 1;

export function parseBedtimeMinutes(hhmm: string): number {
  const trimmed = hhmm.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return 20 * 60;
  }
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return 20 * 60;
  }
  return hours * 60 + minutes;
}

export function minutesToBedtimeString(totalMinutes: number): string {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(wrapped / 60);
  const minutes = wrapped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function formatBedtime12h(hhmm: string): string {
  const total = parseBedtimeMinutes(hhmm);
  const hours24 = Math.floor(total / 60);
  const minutes = total % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
}

export function stepBedtime(hhmm: string, deltaSteps: number): string {
  const next = parseBedtimeMinutes(hhmm) + deltaSteps * BEDTIME_STEP_MINUTES;
  return minutesToBedtimeString(next);
}

export function parseDailyLimitValue(raw: string, fallbackMinutes: number): number {
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(parsed)) {
    return fallbackMinutes;
  }
  return Math.min(DAILY_LIMIT_MAX_MINUTES, Math.max(DAILY_LIMIT_MIN_MINUTES, parsed));
}

export function stepDailyLimit(raw: string, fallbackMinutes: number, deltaSteps: number): string {
  const current = parseDailyLimitValue(raw, fallbackMinutes);
  const next = Math.min(
    DAILY_LIMIT_MAX_MINUTES,
    Math.max(DAILY_LIMIT_MIN_MINUTES, current + deltaSteps * DAILY_LIMIT_STEP_MINUTES)
  );
  return String(next);
}

export function formatDailyLimitDisplay(raw: string, fallbackMinutes: number): string {
  const minutes = parseDailyLimitValue(raw, fallbackMinutes);
  if (minutes >= 60 && minutes % 60 === 0) {
    return `${minutes / 60} hr`;
  }
  if (minutes >= 60) {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hrs} hr ${mins} min` : `${hrs} hr`;
  }
  return `${minutes} min`;
}
