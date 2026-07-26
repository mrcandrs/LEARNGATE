export type ExerciseId = "jumping_jacks" | "squats" | "arm_stretching";

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
    title: "Jumping Jacks",
    emoji: "⭐",
    defaultReps: 10,
    defaultMinutes: 5,
    defaultPoints: 20,
    color: "#8B5CF6",
    instruction: "Raise both arms, then lower them. Each full cycle is one rep.",
    cardDescription: "Arms up, then down — camera counts each jack.",
  },
  {
    id: "squats",
    title: "Squats",
    emoji: "🦵",
    defaultReps: 10,
    defaultMinutes: 5,
    defaultPoints: 25,
    color: "#F59E0B",
    instruction: "Step back so hips show. Squat down, then stand up for +1.",
    cardDescription: "Squat down and stand up — hips must stay in frame.",
  },
  {
    id: "arm_stretching",
    title: "Arm Stretching",
    emoji: "🙆",
    defaultReps: 8,
    defaultMinutes: 5,
    defaultPoints: 25,
    color: "#14B8A6",
    instruction: "Pulse left twice, then right twice. A small bob between pulses is enough.",
    cardDescription: "Two left pulses, then two right — that is 1 rep.",
  },
];

/** Maps legacy task payloads (e.g. `jumping`, `lunges`) to current exercise ids. */
export function normalizeExerciseId(raw: string | undefined): ExerciseId {
  if (raw === "squats" || raw === "arm_stretching" || raw === "jumping_jacks") {
    return raw;
  }
  if (raw === "lunges" || raw === "lunge") {
    return "arm_stretching";
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
