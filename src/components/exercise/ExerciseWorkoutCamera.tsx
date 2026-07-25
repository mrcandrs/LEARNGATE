import { useCallback, useEffect, useMemo, useRef } from "react";
import { StyleSheet } from "react-native";
import { CameraView } from "expo-camera";
import { Camera as PoseStreamCamera } from "react-native-esanusi-sensor-pose";
import type { Pose as StreamPose } from "react-native-esanusi-sensor-pose";
import { useCameraDevice, useCameraFormat } from "react-native-vision-camera";
import { isStreamPoseAvailable } from "@/services/exercisePoseNative";
import type { FrameOrientation } from "@/services/exercisePoseCoords";

type StreamFrame = {
  width: number;
  height: number;
  orientation?: FrameOrientation;
};

type Props = {
  enabled: boolean;
  useLegacyCamera: boolean;
  legacyCameraRef: React.RefObject<CameraView | null>;
  onStreamPose: (pose: StreamPose | null, frame: StreamFrame) => void;
  onCameraReady: () => void;
};

/**
 * Mirror the preview with isMirrored, but do NOT use library mirrorX —
 * that mirrors with buffer width while ML Kit coords use upright content width.
 */
export function ExerciseWorkoutCamera({
  enabled,
  useLegacyCamera,
  legacyCameraRef,
  onStreamPose,
  onCameraReady,
}: Props) {
  const device = useCameraDevice("front");
  const format = useCameraFormat(device, [
    { videoResolution: { width: 720, height: 1280 } },
    { videoResolution: { width: 1280, height: 720 } },
    { fps: 30 },
  ]);
  const onStreamPoseRef = useRef(onStreamPose);
  onStreamPoseRef.current = onStreamPose;

  const handlePoseCallback = useCallback(
    (poses: StreamPose[], frame: StreamFrame & { orientation?: string }) => {
      const orientation = (frame.orientation ?? "portrait") as FrameOrientation;
      onStreamPoseRef.current(poses[0] ?? null, {
        width: frame.width,
        height: frame.height,
        orientation,
      });
    },
    [],
  );

  const poseDetectionOptions = useMemo(
    () => ({
      performanceMode: "fast" as const,
      detectorMode: "stream" as const,
      minLandmarkConfidence: 0.2,
    }),
    [],
  );

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
      format={format}
      isActive={enabled}
      isMirrored
      mirrorX={false}
      resizeMode="cover"
      poseDetectionOptions={poseDetectionOptions}
      poseDetectionCallback={handlePoseCallback}
    />
  );
}
