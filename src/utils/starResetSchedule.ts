/** Weekly star reset: Monday 00:00 Asia/Manila (UTC+8, no DST). */
export const STAR_RESET_TIMEZONE = "Asia/Manila";

function parseManilaParts(from: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: STAR_RESET_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(from);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

function manilaWeekday(from: Date): number {
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: STAR_RESET_TIMEZONE,
    weekday: "short",
  }).format(from);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[label] ?? 0;
}

/** Manila wall-clock as UTC instant (fixed UTC+8). */
export function manilaWallClockToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, second));
}

/** Next Monday 00:00:00 Asia/Manila. */
export function getNextStarResetAt(from: Date = new Date()): Date {
  const { year, month, day } = parseManilaParts(from);
  const dow = manilaWeekday(from);
  const daysSinceMonday = (dow + 6) % 7;

  const mondayAnchor = new Date(Date.UTC(year, month - 1, day - daysSinceMonday));
  const mondayY = mondayAnchor.getUTCFullYear();
  const mondayMo = mondayAnchor.getUTCMonth() + 1;
  const mondayD = mondayAnchor.getUTCDate();

  const thisMondayReset = manilaWallClockToUtc(mondayY, mondayMo, mondayD, 0, 0, 0);

  if (from.getTime() >= thisMondayReset.getTime()) {
    const nextMondayAnchor = new Date(Date.UTC(mondayY, mondayMo - 1, mondayD + 7));
    return manilaWallClockToUtc(
      nextMondayAnchor.getUTCFullYear(),
      nextMondayAnchor.getUTCMonth() + 1,
      nextMondayAnchor.getUTCDate(),
      0,
      0,
      0
    );
  }

  return thisMondayReset;
}

export function getStarResetCountdownMs(from: Date = new Date()): number {
  return Math.max(0, getNextStarResetAt(from).getTime() - from.getTime());
}

/** dd:hh:mm:ss until the next reset (Manila Monday midnight). */
export function formatStarResetCountdown(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(days).padStart(2, "0")}:${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function starResetScheduleLabel(): string {
  return "Monday 12:00 AM Manila time";
}
