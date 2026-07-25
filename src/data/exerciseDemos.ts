import type { ExerciseId } from "@/data/exercises";

export type ExerciseDemoStep = {
  title: string;
  detail: string;
};

export type ExerciseDemo = {
  id: ExerciseId;
  summary: string;
  steps: ExerciseDemoStep[];
  tip: string;
};

export const EXERCISE_DEMOS: Record<ExerciseId, ExerciseDemo> = {
  jumping_jacks: {
    id: "jumping_jacks",
    summary: "Red border = arms up. Green border = bring arms down. +1 when you finish one full jack.",
    steps: [
      { title: "Start (red)", detail: "Stand in the border with arms down." },
      { title: "Arms up (green)", detail: "Raise both arms up or out wide — border turns green." },
      { title: "Arms down (+1)", detail: "Bring arms back down. That is one rep." },
    ],
    tip: "Keep shoulders and arms inside the border.",
  },
  squats: {
    id: "squats",
    summary: "Red border = squat down. Green border = stand up. +1 when you finish.",
    steps: [
      { title: "Start (red)", detail: "Stand in the border so shoulders and hips are visible." },
      { title: "Squat down (green)", detail: "Lower your hips — border turns green." },
      { title: "Stand up (+1)", detail: "Stand all the way up. That is one rep." },
    ],
    tip: "Step back until your hips show in the border.",
  },
  lunges: {
    id: "lunges",
    summary: "Red border = step into a lunge. Green border = stand up. +1 when you finish.",
    steps: [
      { title: "Start (red)", detail: "Stand in the border with both knees visible." },
      { title: "Lunge (green)", detail: "Step one foot forward and bend — border turns green." },
      { title: "Stand up (+1)", detail: "Return to standing. That is one rep." },
    ],
    tip: "Step back so both knees stay in the border.",
  },
};

export function getExerciseDemo(id: ExerciseId): ExerciseDemo {
  return EXERCISE_DEMOS[id];
}
