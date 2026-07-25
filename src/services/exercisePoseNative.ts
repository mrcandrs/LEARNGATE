import { deleteAsync } from "expo-file-system/legacy";
import { Platform } from "react-native";
import { PoseDetection } from "@mefitzgerald/expo-pose-detection";
import type { PoseLandmark } from "@mefitzgerald/expo-pose-detection";

/** Bump when exercise AI logic changes — shown on workout HUD so you know JS loaded. */
export const EXERCISE_AI_BUILD = "pose-v43";

function hasNativeStreamModules(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("react-native-vision-camera");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("react-native-esanusi-sensor-pose");
    return true;
  } catch {
    return false;
  }
}

/** Safe read — expo-device may be missing until the next native rebuild. */
function runningOnPhysicalDevice(): boolean {
  if (Platform.OS !== "android") return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Device = require("expo-device") as { isDevice?: boolean };
    if (typeof Device.isDevice === "boolean") {
      return Device.isDevice;
    }
  } catch {
    // fall through
  }
  // If stream native modules are linked, prefer live Pose AI over motion blur.
  return hasNativeStreamModules();
}

/**
 * Pose AI runs only on physical Android devices. Emulators (MuMu, etc.) often crash when
 * hammering ML Kit with rapid still captures — motion fallback is used there instead.
 */
export function isPoseDetectionAvailable(): boolean {
  return runningOnPhysicalDevice();
}

/** Live ML Kit stream via VisionCamera (Kids360 / panelists-style) on physical Android. */
export function isStreamPoseAvailable(): boolean {
  return Platform.OS === "android" && hasNativeStreamModules() && runningOnPhysicalDevice();
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
    void deleteAsync(uri, { idempotent: true }).catch(() => undefined);
  }
}
