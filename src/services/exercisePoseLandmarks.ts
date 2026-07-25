import type { PoseLandmark } from "@mefitzgerald/expo-pose-detection";
import type { Pose as StreamPose } from "react-native-esanusi-sensor-pose";

/** BlazePose landmark indices used across exercise detection. */
export const BLAZE_POSE = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;

/**
 * Full body skeleton bones (BlazePose-style) for the overlay.
 * Only segments whose endpoints are present get drawn.
 */
export const FULL_BODY_CONNECTIONS: Array<[number, number]> = [
  // Head → torso
  [0, 11],
  [0, 12],
  // Shoulders + arms
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  // Torso
  [11, 23],
  [12, 24],
  [23, 24],
  // Legs
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
];

/** Joints drawn as dots on the full skeleton. */
export const FULL_BODY_JOINTS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28] as const;

/** Squats need these — highlighted larger on the overlay. */
export const SQUAT_KEY_JOINTS = new Set([11, 12, 23, 24, 25, 26]);

/** Arm stretching — shoulders, elbows, wrists. */
export const ARM_STRETCH_KEY_JOINTS = new Set([11, 12, 13, 14, 15, 16]);

/** Jumping jacks — arms + hips for spread. */
export const JACKS_KEY_JOINTS = new Set([11, 12, 13, 14, 15, 16, 23, 24]);

export function keyJointsForExercise(exerciseId?: string): Set<number> {
  if (exerciseId === "arm_stretching") return ARM_STRETCH_KEY_JOINTS;
  if (exerciseId === "jumping_jacks") return JACKS_KEY_JOINTS;
  return SQUAT_KEY_JOINTS;
}

const STREAM_TO_BLAZE: Array<{ key: keyof StreamPose; type: number }> = [
  { key: "nose", type: 0 },
  { key: "leftShoulder", type: 11 },
  { key: "rightShoulder", type: 12 },
  { key: "leftElbow", type: 13 },
  { key: "rightElbow", type: 14 },
  { key: "leftWrist", type: 15 },
  { key: "rightWrist", type: 16 },
  { key: "leftHip", type: 23 },
  { key: "rightHip", type: 24 },
  { key: "leftKnee", type: 25 },
  { key: "rightKnee", type: 26 },
  { key: "leftAnkle", type: 27 },
  { key: "rightAnkle", type: 28 },
];

/** Convert ML Kit stream pose (named landmarks) into BlazePose-indexed array. */
export function streamPoseToLandmarks(pose: StreamPose | null | undefined): PoseLandmark[] | null {
  if (!pose) return null;

  const landmarks: PoseLandmark[] = [];
  for (const { key, type } of STREAM_TO_BLAZE) {
    const lm = pose[key];
    if (!lm) continue;
    landmarks.push({
      type,
      x: lm.x,
      y: lm.y,
      z: lm.z ?? 0,
      inFrameLikelihood: lm.inFrameLikelihood ?? 0.9,
    });
  }

  return landmarks.length ? landmarks : null;
}
