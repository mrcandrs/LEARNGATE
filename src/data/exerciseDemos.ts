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
    summary: "Jump with feet together and arms down, then spread legs wide with arms overhead, then return. One full cycle = 1 rep.",
    steps: [
      { title: "Start", detail: "Feet together, arms resting at your sides." },
      { title: "Jump open", detail: "Jump — spread legs wide and raise both arms above your head at the same time." },
      { title: "Jump closed", detail: "Jump back to feet together with arms down. That is one rep." },
    ],
    tip: "Step back until your whole body fits in the frame — head to feet.",
  },
  squats: {
    id: "squats",
    summary: "Stand tall, push hips back and bend knees, then stand back up. One full down-and-up = 1 rep.",
    steps: [
      { title: "Stand tall", detail: "Feet shoulder-width apart, facing the camera." },
      { title: "Squat down", detail: "Push hips back and bend knees — thighs aim toward parallel to the floor." },
      { title: "Stand up", detail: "Push through your heels to return to standing. That is one rep." },
    ],
    tip: "Keep your full body visible — the green skeleton turns orange if you are too close.",
  },
  lunges: {
    id: "lunges",
    summary: "Stand with feet together, step forward into a lunge, then step back to stand. One lunge = 1 rep.",
    steps: [
      { title: "Stand tall", detail: "Feet together, facing the camera." },
      { title: "Step and bend", detail: "Take a big step forward. Bend the front knee; back leg stays straighter." },
      { title: "Step back", detail: "Push off the front foot to return feet together. That is one rep." },
    ],
    tip: "Stay far enough back that both legs stay inside the camera frame.",
  },
};

export function getExerciseDemo(id: ExerciseId): ExerciseDemo {
  return EXERCISE_DEMOS[id];
}
