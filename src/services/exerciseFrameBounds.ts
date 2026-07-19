import type { ExerciseId } from "@/data/exercises";

/** Upper-body exercises (jumping jacks). */
export const EXERCISE_FRAME_MARGIN_X = 0.03;
export const EXERCISE_FRAME_MARGIN_Y = 0.02;

/** Leg exercises — use almost the full screen height for head-to-knee framing. */
export const EXERCISE_FRAME_MARGIN_X_FULL = 0.04;
export const EXERCISE_FRAME_MARGIN_Y_FULL = 0.008;

export function isFullBodyExercise(exerciseId?: ExerciseId): boolean {
  return exerciseId === "squats" || exerciseId === "lunges" || exerciseId === "jumping_jacks";
}

export function exerciseFrameMargins(exerciseId?: ExerciseId) {
  if (isFullBodyExercise(exerciseId)) {
    return {
      marginX: EXERCISE_FRAME_MARGIN_X_FULL,
      marginY: EXERCISE_FRAME_MARGIN_Y_FULL,
    };
  }
  return {
    marginX: EXERCISE_FRAME_MARGIN_X,
    marginY: EXERCISE_FRAME_MARGIN_Y,
  };
}

export function exerciseFrameBoundsNormalized(exerciseId?: ExerciseId) {
  const { marginX, marginY } = exerciseFrameMargins(exerciseId);
  return {
    left: marginX,
    right: 1 - marginX,
    top: marginY,
    bottom: 1 - marginY,
  };
}
