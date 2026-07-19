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
    instruction:
      "Stay in the border. Raise arms up/out, then bring them down — shoulders and arms must be visible.",
    cardDescription: "Jumping jacks — arm pose tracking.",
  },
  {
    id: "squats",
    title: "Squat",
    emoji: "🦵",
    defaultReps: 10,
    defaultMinutes: 5,
    defaultPoints: 25,
    color: "#F59E0B",
    instruction:
      "Show shoulders, hips, and knees in the border. Squat down, then stand up.",
    cardDescription: "Squats — half-body pose tracking.",
  },
  {
    id: "lunges",
    title: "Lunge",
    emoji: "🏃",
    defaultReps: 10,
    defaultMinutes: 5,
    defaultPoints: 25,
    color: "#14B8A6",
    instruction:
      "Show both knees in the border. Step into a lunge, then stand back up.",
    cardDescription: "Lunges — half-body pose tracking.",
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
