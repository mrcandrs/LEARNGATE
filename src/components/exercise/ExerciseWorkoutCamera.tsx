import { useCallback, useEffect, useRef } from "react";
import { StyleSheet } from "react-native";
import { CameraView } from "expo-camera";
import { Camera as PoseStreamCamera } from "react-native-esanusi-sensor-pose";
import type { Pose as StreamPose } from "react-native-esanusi-sensor-pose";
import { useCameraDevice } from "react-native-vision-camera";
import { isStreamPoseAvailable } from "@/services/exercisePoseNative";

type StreamFrame = {
  width: number;
  height: number;
};

type Props = {
  enabled: boolean;
  useLegacyCamera: boolean;
  legacyCameraRef: React.RefObject<CameraView | null>;
  onStreamPose: (pose: StreamPose | null, frame: StreamFrame) => void;
  onCameraReady: () => void;
};

/**
 * Physical device: VisionCamera + ML Kit stream mode (Kids360-style live pose).
 * Emulator: expo-camera preview only — motion/pose loop handled elsewhere.
 */
export function ExerciseWorkoutCamera({
  enabled,
  useLegacyCamera,
  legacyCameraRef,
  onStreamPose,
  onCameraReady,
}: Props) {
  const device = useCameraDevice("front");
  const onStreamPoseRef = useRef(onStreamPose);
  onStreamPoseRef.current = onStreamPose;

  const handlePoseCallback = useCallback((poses: StreamPose[], frame: StreamFrame) => {
    onStreamPoseRef.current(poses[0] ?? null, frame);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (useLegacyCamera) return;
    if (device) onCameraReady();
  }, [device, enabled, onCameraReady, useLegacyCamera]);

  if (!enabled) return null;

  if (useLegacyCamera || !isStreamPoseAvailable() || !device) {
    return (
      <CameraView
        ref={legacyCameraRef}
        style={StyleSheet.absoluteFill}
        facing="front"
        onCameraReady={onCameraReady}
      />
    );
  }

  return (
    <PoseStreamCamera
      style={StyleSheet.absoluteFill}
      device={device}
      isActive={enabled}
      mirrorX
      poseDetectionOptions={{
        performanceMode: "accurate",
        detectorMode: "stream",
        minLandmarkConfidence: 0.3,
      }}
      poseDetectionCallback={handlePoseCallback}
    />
  );
}
