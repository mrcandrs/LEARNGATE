import type { ExerciseId } from "@/data/exercises";
import type { MoveStatus } from "@/services/exerciseRepDetection";
import type { PoseLandmark } from "@mefitzgerald/expo-pose-detection";
import {
  averagePoseConfidence,
  isBodyInFrame,
} from "@/services/exercisePoseCoords";
import { evaluateLegGate } from "@/services/exercisePoseLegGate";
import type { PoseDetectionHint } from "@/services/exercisePoseRepDetection";
import { hasExercisePoseBody, needsLegsInFrame } from "@/services/exercisePoseRepDetection";

const MIN_CONFIDENCE = 0.24;

export type PoseFormQuality = "none" | "too_dark" | "too_far" | "partial" | "good" | "active";

export type PoseFormFeedback = {
  quality: PoseFormQuality;
  message: string;
};

export function evaluatePoseFormQuality(
  landmarks: PoseLandmark[] | null,
  moveStatus: MoveStatus,
  exerciseId?: ExerciseId,
  frameWidth = 720,
  frameHeight = 1280,
): PoseFormFeedback {
  if (!landmarks?.length) {
    return { quality: "too_far", message: "Stand inside the border" };
  }

  if (averagePoseConfidence(landmarks) < MIN_CONFIDENCE) {
    return { quality: "too_dark", message: "Turn on more light" };
  }

  if (!hasExercisePoseBody(landmarks, exerciseId)) {
    return {
      quality: "partial",
      message: needsLegsInFrame(exerciseId)
        ? "Step back — show head to knees"
        : "Show your shoulders and arms",
    };
  }

  if (needsLegsInFrame(exerciseId)) {
    const gate = evaluateLegGate(landmarks, exerciseId!, frameWidth, frameHeight);
    if (!gate.ok) {
      return { quality: "partial", message: gate.message };
    }
  }

  if (!isBodyInFrame(landmarks, frameWidth, frameHeight, exerciseId)) {
    return { quality: "partial", message: "Move inside the border" };
  }

  if (moveStatus === "Rep!" || moveStatus === "Move!") {
    return { quality: "active", message: "" };
  }

  return { quality: "good", message: "" };
}

/** One line on screen — no duplicate badges. */
export function workoutStatusLine(
  form: PoseFormFeedback,
  moveStatus: MoveStatus,
  hint: PoseDetectionHint | null,
): string {
  if (moveStatus === "Rep!") return "Great rep! +1";
  if (hint === "Hold still — calibrating…") return hint;
  if (form.quality === "too_dark" || form.quality === "too_far" || form.quality === "partial") {
    return form.message;
  }
  if (moveStatus === "Move!" && hint) return hint;
  if (form.quality === "active" && hint) return hint;
  if (form.quality === "good") return "Ready — start moving!";
  return form.message || "Stand inside the border";
}

export function formQualityColor(quality: PoseFormQuality): string {
  switch (quality) {
    case "too_dark":
    case "too_far":
      return "#EF4444";
    case "partial":
      return "#F97316";
    case "good":
      return "#22C55E";
    case "active":
      return "#4ADE80";
    default:
      return "#94A3B8";
  }
}

export function frameTintColor(quality: PoseFormQuality): string {
  switch (quality) {
    case "too_dark":
    case "too_far":
      return "rgba(239, 68, 68, 0.22)";
    case "partial":
      return "rgba(249, 115, 22, 0.18)";
    case "good":
      return "rgba(34, 197, 94, 0.14)";
    case "active":
      return "rgba(74, 222, 128, 0.2)";
    default:
      return "rgba(148, 163, 184, 0.12)";
  }
}

export function silhouetteFillColor(quality: PoseFormQuality): string {
  return frameTintColor(quality);
}
