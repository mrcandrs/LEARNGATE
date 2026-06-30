import { CHILD_AGE_MAX, CHILD_AGE_MIN } from "@/data/childAgeBands";

/** Calendar dates for child birthdays follow Asia/Manila (same as star reset). */
export const CHILD_BIRTHDAY_TIMEZONE = "Asia/Manila";

export type ManilaYmd = { year: number; month: number; day: number };

export function manilaToday(from: Date = new Date()): ManilaYmd {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CHILD_BIRTHDAY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(from);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  return { year: get("year"), month: get("month"), day: get("day") };
}

export function birthdayIsoFromParts(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseBirthdayIso(iso: string): ManilaYmd | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return { year, month, day };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Whole years since birthday, using today's date in Manila. */
export function computeAgeFromBirthday(birthdayIso: string, from: Date = new Date()): number {
  const born = parseBirthdayIso(birthdayIso);
  if (!born) {
    return CHILD_AGE_MIN;
  }
  const today = manilaToday(from);
  let age = today.year - born.year;
  if (today.month < born.month || (today.month === born.month && today.day < born.day)) {
    age -= 1;
  }
  return age;
}

export function getChildAge(child: { birthday?: string | null; age?: number | null }): number {
  if (child.birthday) {
    return computeAgeFromBirthday(child.birthday);
  }
  if (typeof child.age === "number" && !Number.isNaN(child.age)) {
    return Math.min(CHILD_AGE_MAX, Math.max(CHILD_AGE_MIN, Math.round(child.age)));
  }
  return CHILD_AGE_MIN;
}

export function birthdayYearRange(from: Date = new Date()): { minYear: number; maxYear: number } {
  const today = manilaToday(from);
  return {
    minYear: today.year - CHILD_AGE_MAX,
    maxYear: today.year - CHILD_AGE_MIN,
  };
}

/** Sensible default when adding a child (~7 years old). */
export function defaultBirthdayForNewChild(from: Date = new Date()): string {
  const today = manilaToday(from);
  return birthdayIsoFromParts(today.year - 7, today.month, today.day);
}

export function validateBirthdayIso(
  birthdayIso: string,
  from: Date = new Date()
): { ok: true; birthday: string; age: number } | { ok: false; message: string } {
  const born = parseBirthdayIso(birthdayIso);
  if (!born) {
    return { ok: false, message: "Please pick a valid birthday." };
  }
  if (born.day > daysInMonth(born.year, born.month)) {
    return { ok: false, message: "That day is not valid for the selected month." };
  }

  const iso = birthdayIsoFromParts(born.year, born.month, born.day);
  const age = computeAgeFromBirthday(iso, from);
  const today = manilaToday(from);
  const bornMs = Date.UTC(born.year, born.month - 1, born.day);
  const todayMs = Date.UTC(today.year, today.month - 1, today.day);
  if (bornMs > todayMs) {
    return { ok: false, message: "Birthday cannot be in the future." };
  }
  if (age < CHILD_AGE_MIN || age > CHILD_AGE_MAX) {
    return {
      ok: false,
      message: `LearnGate is for children ages ${CHILD_AGE_MIN}–${CHILD_AGE_MAX}. This birthday gives age ${age}.`,
    };
  }
  return { ok: true, birthday: iso, age };
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function formatBirthdayDisplay(birthdayIso: string): string {
  const born = parseBirthdayIso(birthdayIso);
  if (!born) {
    return birthdayIso;
  }
  return `${MONTH_NAMES[born.month - 1]} ${born.day}, ${born.year}`;
}

export function formatChildAgeLine(child: { birthday?: string | null; age?: number | null }): string {
  const age = getChildAge(child);
  if (child.birthday) {
    return `Age ${age} · Born ${formatBirthdayDisplay(child.birthday)}`;
  }
  return `Age ${age}`;
}

export function childBirthdayFieldHelper(): string {
  return `Pick birthday (ages ${CHILD_AGE_MIN}–${CHILD_AGE_MAX}, Manila date)`;
}
