export type ExerciseId = "jumping_jacks" | "squats" | "lunges";

export type ExerciseDefinition = {
  id: ExerciseId;
  title: string;
  emoji: string;
  defaultReps: number;
  defaultMinutes: number;
  defaultPoints: number;
  color: string;
  instruction: string;
  cardDescription: string;
};

export const EXERCISES: ExerciseDefinition[] = [
  {
    id: "jumping_jacks",
    title: "Jumping Jack",
    emoji: "⭐",
    defaultReps: 10,
    defaultMinutes: 5,
    defaultPoints: 20,
    color: "#8B5CF6",
    instruction: "Red = arms up. Green = bring arms down. +1 when you finish.",
    cardDescription: "Jumping jacks — red start, green finish.",
  },
  {
    id: "squats",
    title: "Squat",
    emoji: "🦵",
    defaultReps: 10,
    defaultMinutes: 5,
    defaultPoints: 25,
    color: "#F59E0B",
    instruction: "Step back so hips show. Red = squat down. Green = stand up.",
    cardDescription: "Squats — Kids360-style torso tracking.",
  },
  {
    id: "lunges",
    title: "Lunge",
    emoji: "🏃",
    defaultReps: 10,
    defaultMinutes: 5,
    defaultPoints: 25,
    color: "#14B8A6",
    instruction: "Step back so both knees show. Red = lunge. Green = stand up.",
    cardDescription: "Lunges — Kids360-style knee tracking.",
  },
];

/** Maps legacy task payloads (e.g. `jumping`) to current exercise ids. */
export function normalizeExerciseId(raw: string | undefined): ExerciseId {
  if (raw === "squats" || raw === "lunges" || raw === "jumping_jacks") {
    return raw;
  }
  if (raw === "jumping") {
    return "jumping_jacks";
  }
  return "jumping_jacks";
}

export function getExerciseById(id: ExerciseId | string): ExerciseDefinition {
  const normalized = normalizeExerciseId(typeof id === "string" ? id : undefined);
  return EXERCISES.find((e) => e.id === normalized) ?? EXERCISES[0];
}
