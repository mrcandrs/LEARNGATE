export const CHILD_AGE_MIN = 3;
export const CHILD_AGE_MAX = 13;

export type AgeBandId = "preschooler" | "pupil" | "adolescent";

export type AgeBandDefinition = {
  id: AgeBandId;
  label: string;
  shortLabel: string;
  minAge: number;
  maxAge: number;
  emoji: string;
  /** Shown on Activities / games header */
  heroTitle: string;
  heroSubtitle: string;
  gamesHint: string;
};

export const AGE_BANDS: AgeBandDefinition[] = [
  {
    id: "preschooler",
    label: "Preschooler",
    shortLabel: "Ages 3–6",
    minAge: 3,
    maxAge: 6,
    emoji: "🌈",
    heroTitle: "Little Learner Zone",
    heroSubtitle: "Playful games for curious preschoolers",
    gamesHint: "Tap a game to explore letters, numbers, colors, and shapes!",
  },
  {
    id: "pupil",
    label: "Pupil",
    shortLabel: "Ages 7–9",
    minAge: 7,
    maxAge: 9,
    emoji: "🚀",
    heroTitle: "Super Scholar Zone",
    heroSubtitle: "Build skills with fun challenges",
    gamesHint: "Games picked for your age — math, science, and more!",
  },
  {
    id: "adolescent",
    label: "Adolescent",
    shortLabel: "Ages 10–13",
    minAge: 10,
    maxAge: 13,
    emoji: "⚡",
    heroTitle: "Brain Power Zone",
    heroSubtitle: "Tricky puzzles for growing minds",
    gamesHint: "Ready for bigger challenges? Jump in and earn stars!",
  },
];

export function normalizeChildAge(age: number | null | undefined): number {
  if (typeof age !== "number" || Number.isNaN(age)) {
    return CHILD_AGE_MIN;
  }
  return Math.min(CHILD_AGE_MAX, Math.max(CHILD_AGE_MIN, Math.round(age)));
}

export function getAgeBandForAge(age: number | null | undefined): AgeBandId {
  const a = normalizeChildAge(age);
  const band = AGE_BANDS.find((b) => a >= b.minAge && a <= b.maxAge);
  return band?.id ?? "pupil";
}

export function getAgeBandDefinition(bandId: AgeBandId): AgeBandDefinition {
  return AGE_BANDS.find((b) => b.id === bandId) ?? AGE_BANDS[1];
}

export function getAgeBandForChild(age: number | null | undefined): AgeBandDefinition {
  return getAgeBandDefinition(getAgeBandForAge(age));
}

export function validateChildAgeInput(raw: string | number): { ok: true; age: number } | { ok: false; message: string } {
  const age = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (Number.isNaN(age) || !Number.isInteger(age)) {
    return { ok: false, message: `Use birthday instead — ages ${CHILD_AGE_MIN}–${CHILD_AGE_MAX} only.` };
  }
  if (age < CHILD_AGE_MIN || age > CHILD_AGE_MAX) {
    return {
      ok: false,
      message: `LearnGate is for children ages ${CHILD_AGE_MIN}–${CHILD_AGE_MAX}.`,
    };
  }
  return { ok: true, age };
}

import { childBirthdayFieldHelper } from "@/utils/childBirthday";

export function childAgeFieldHelper(): string {
  return childBirthdayFieldHelper();
}
