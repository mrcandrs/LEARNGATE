import { deleteAsync } from "expo-file-system/legacy";
import { Platform } from "react-native";
import { PoseDetection } from "@mefitzgerald/expo-pose-detection";
import type { PoseLandmark } from "@mefitzgerald/expo-pose-detection";

/** Safe read — expo-device may be missing until the next native rebuild. */
function runningOnPhysicalDevice(): boolean {
  if (Platform.OS !== "android") return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Device = require("expo-device") as { isDevice?: boolean };
    if (typeof Device.isDevice === "boolean") {
      return Device.isDevice;
    }
    return false;
  } catch {
    // Native module not linked yet — use motion fallback (safe on emulators).
    return false;
  }
}

/**
 * Pose AI runs only on physical Android devices. Emulators (MuMu, etc.) often crash when
 * hammering ML Kit with rapid still captures — motion fallback is used there instead.
 */
export function isPoseDetectionAvailable(): boolean {
  return runningOnPhysicalDevice();
}

/** Live ML Kit stream via VisionCamera (Kids360-style) on physical Android. */
export function isStreamPoseAvailable(): boolean {
  return runningOnPhysicalDevice();
}

export function isExerciseEmulator(): boolean {
  return Platform.OS === "android" && !runningOnPhysicalDevice();
}

export async function detectPoseFromImageUri(uri: string): Promise<PoseLandmark[] | null> {
  if (!isPoseDetectionAvailable() || !uri) {
    return null;
  }
  try {
    const landmarks = await PoseDetection.detectPose(uri);
    return landmarks?.length ? landmarks : null;
  } catch {
    return null;
  } finally {
    // Still captures pile up on disk and memory if we never delete them.
    void deleteAsync(uri, { idempotent: true }).catch(() => undefined);
  }
}
