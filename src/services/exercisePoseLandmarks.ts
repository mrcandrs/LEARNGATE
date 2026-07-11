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

const STREAM_TO_BLAZE: Array<{ key: keyof StreamPose; type: number }> = [
  { key: "nose", type: 0 },
  { key: "leftEyeInner", type: 1 },
  { key: "leftEye", type: 2 },
  { key: "leftEyeOuter", type: 3 },
  { key: "rightEyeInner", type: 4 },
  { key: "rightEye", type: 5 },
  { key: "rightEyeOuter", type: 6 },
  { key: "leftEar", type: 7 },
  { key: "rightEar", type: 8 },
  { key: "leftMouth", type: 9 },
  { key: "rightMouth", type: 10 },
  { key: "leftShoulder", type: 11 },
  { key: "rightShoulder", type: 12 },
  { key: "leftElbow", type: 13 },
  { key: "rightElbow", type: 14 },
  { key: "leftWrist", type: 15 },
  { key: "rightWrist", type: 16 },
  { key: "leftPinky", type: 17 },
  { key: "rightPinky", type: 18 },
  { key: "leftIndex", type: 19 },
  { key: "rightIndex", type: 20 },
  { key: "leftThumb", type: 21 },
  { key: "rightThumb", type: 22 },
  { key: "leftHip", type: 23 },
  { key: "rightHip", type: 24 },
  { key: "leftKnee", type: 25 },
  { key: "rightKnee", type: 26 },
  { key: "leftAnkle", type: 27 },
  { key: "rightAnkle", type: 28 },
  { key: "leftHeel", type: 29 },
  { key: "rightHeel", type: 30 },
  { key: "leftFootIndex", type: 31 },
  { key: "rightFootIndex", type: 32 },
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
