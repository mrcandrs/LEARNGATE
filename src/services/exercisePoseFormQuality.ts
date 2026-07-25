import type { ExerciseId } from "@/data/exercises";
import type { MoveStatus } from "@/services/exerciseRepDetection";
import type { PoseLandmark } from "@mefitzgerald/expo-pose-detection";
import { averagePoseConfidence } from "@/services/exercisePoseCoords";
import { evaluateLegGate } from "@/services/exercisePoseLegGate";
import {
  GO_HINT,
  READY_HINT,
  type PoseDetectionHint,
} from "@/services/exercisePoseRepDetection";

const MIN_CONFIDENCE = 0.2;

export type PoseFormQuality = "none" | "red" | "green";

export type PoseFormFeedback = {
  quality: PoseFormQuality;
  message: string;
};

/**
 * Traffic light for kids:
 * - GREEN = finish the move (or just scored)
 * - RED   = start the move / fix framing
 */
export function evaluatePoseFormQuality(
  landmarks: PoseLandmark[] | null,
  moveStatus: MoveStatus,
  exerciseId?: ExerciseId,
  _frameWidth = 720,
  _frameHeight = 1280,
): PoseFormFeedback {
  const id = exerciseId ?? "squats";

  if (moveStatus === "Rep!") {
    return { quality: "green", message: "+1 Nice!" };
  }
  if (moveStatus === "Move!") {
    return { quality: "green", message: GO_HINT[id] };
  }

  if (!landmarks?.length) {
    return { quality: "red", message: "Stand in the border" };
  }

  if (averagePoseConfidence(landmarks) < MIN_CONFIDENCE) {
    return { quality: "red", message: "Need more light" };
  }

  const gate = evaluateLegGate(landmarks, id);
  if (!gate.ok) {
    return { quality: "red", message: gate.message };
  }

  return { quality: "red", message: READY_HINT[id] };
}

/** One kid-facing line for the frame + HUD (never "Watching" / "Move!"). */
export function workoutStatusLine(
  form: PoseFormFeedback,
  moveStatus: MoveStatus,
  hint: PoseDetectionHint | null,
  exerciseId?: ExerciseId,
): string {
  const id = exerciseId ?? "squats";

  if (moveStatus === "Rep!") {
    if (hint && hint.startsWith("+1")) return hint;
    return "+1 Nice!";
  }
  if (moveStatus === "Move!") {
    return hint || GO_HINT[id];
  }
  if (form.message) return form.message;
  return hint || READY_HINT[id];
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
