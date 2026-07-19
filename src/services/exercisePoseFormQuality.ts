import type { ExerciseId } from "@/data/exercises";
import type { MoveStatus } from "@/services/exerciseRepDetection";
import type { PoseLandmark } from "@mefitzgerald/expo-pose-detection";
import {
  averagePoseConfidence,
  isBodyInFrame,
} from "@/services/exercisePoseCoords";
import { evaluateLegGate } from "@/services/exercisePoseLegGate";
import type { PoseDetectionHint } from "@/services/exercisePoseRepDetection";
import { EXERCISE_AI_BUILD } from "@/services/exercisePoseNative";

const MIN_CONFIDENCE = 0.22;

export type PoseFormQuality = "none" | "red" | "green";

export type PoseFormFeedback = {
  quality: PoseFormQuality;
  message: string;
};

/**
 * Green = correct exercise movement in progress or rep counted.
 * Red = not doing that movement yet / not framed for this exercise.
 */
export function evaluatePoseFormQuality(
  landmarks: PoseLandmark[] | null,
  moveStatus: MoveStatus,
  exerciseId?: ExerciseId,
  frameWidth = 720,
  frameHeight = 1280,
): PoseFormFeedback {
  if (moveStatus === "Rep!" || moveStatus === "Move!") {
    return { quality: "green", message: "" };
  }

  if (!landmarks?.length) {
    return { quality: "red", message: "Stand inside the border" };
  }

  if (averagePoseConfidence(landmarks) < MIN_CONFIDENCE) {
    return { quality: "red", message: "Turn on more light" };
  }

  const gate = evaluateLegGate(landmarks, exerciseId ?? "squats", frameWidth, frameHeight);
  if (!gate.ok) {
    return { quality: "red", message: gate.message };
  }

  if (!isBodyInFrame(landmarks, frameWidth, frameHeight, exerciseId)) {
    return { quality: "red", message: "Move so your body is inside the border" };
  }

  return { quality: "red", message: "" };
}

export function workoutStatusLine(
  form: PoseFormFeedback,
  moveStatus: MoveStatus,
  hint: PoseDetectionHint | null,
): string {
  if (moveStatus === "Rep!") return hint || "Great rep! +1";
  if (moveStatus === "Move!" && hint) return hint;
  if (form.quality === "red" && form.message) return form.message;
  if (form.quality === "red") {
    return hint || `Ready — do the exercise (${EXERCISE_AI_BUILD})`;
  }
  return form.message || "Stand inside the border";
}

export function formQualityColor(quality: PoseFormQuality): string {
  switch (quality) {
    case "green":
      return "#22C55E";
    case "red":
    default:
      return "#EF4444";
  }
}

export function frameTintColor(quality: PoseFormQuality): string {
  switch (quality) {
    case "green":
      return "rgba(34, 197, 94, 0.22)";
    case "red":
    default:
      return "rgba(239, 68, 68, 0.22)";
  }
}

export function silhouetteFillColor(quality: PoseFormQuality): string {
  return frameTintColor(quality);
}
