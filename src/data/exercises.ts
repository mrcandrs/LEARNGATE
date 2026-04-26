export type ExerciseId = "jumping" | "squats";

export type ExerciseDefinition = {
  id: ExerciseId;
  title: string;
  /** default reps for a session */
  defaultReps: number;
  /** default minutes shown on card */
  defaultMinutes: number;
  /** suggested reward points */
  defaultPoints: number;
  /** UI accent */
  color: string;
  /** short instruction */
  instruction: string;
};

export const EXERCISES: ExerciseDefinition[] = [
  {
    id: "jumping",
    title: "Jumping",
    defaultReps: 10,
    defaultMinutes: 5,
    defaultPoints: 20,
    color: "#8B5CF6",
    instruction: "Jump inside the frame. Tap +1 after each jump.",
  },
  {
    id: "squats",
    title: "Squats",
    defaultReps: 10,
    defaultMinutes: 5,
    defaultPoints: 25,
    color: "#F59E0B",
    instruction: "Do a squat inside the frame. Tap +1 after each squat.",
  },
];

export function getExerciseById(id: ExerciseId): ExerciseDefinition {
  const found = EXERCISES.find((e) => e.id === id);
  return found ?? EXERCISES[0];
}

