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
    summary: "Raise both arms, then lower them. Each full cycle counts as one rep.",
    steps: [
      { title: "Ready", detail: "Stand in the frame with arms down." },
      { title: "Raise arms", detail: "Lift both arms up or out wide — the frame turns green." },
      { title: "Lower arms", detail: "Bring your arms back down for +1." },
    ],
    tip: "Keep your shoulders and arms visible in the frame.",
  },
  squats: {
    id: "squats",
    summary: "Squat down, then stand up. Each full cycle counts as one rep.",
    steps: [
      { title: "Ready", detail: "Stand in the frame so shoulders and hips are visible." },
      { title: "Squat down", detail: "Lower your hips — the frame turns green." },
      { title: "Stand up", detail: "Stand all the way up for +1." },
    ],
    tip: "Step back until your hips show clearly in the frame.",
  },
  arm_stretching: {
    id: "arm_stretching",
    summary: "Pulse your left arm up twice, then your right twice. A small bob between pulses is enough.",
    steps: [
      { title: "Ready", detail: "Stand tall with both arms visible in the frame." },
      { title: "Left ×2", detail: "Reach left up, ease a little, reach again." },
      { title: "Right ×2", detail: "Same on the right — two pulses = +1." },
    ],
    tip: "Keep feet planted. Pulse each side twice without dropping your arms all the way.",
  },
};

export function getExerciseDemo(id: ExerciseId): ExerciseDemo {
  return EXERCISE_DEMOS[id];
}
