import { useCallback, useEffect, useRef, useState } from "react";
import { unstable_batchedUpdates } from "react-native";
import type { CameraView } from "expo-camera";
import * as Haptics from "expo-haptics";
import { deleteAsync } from "expo-file-system/legacy";
import type { PoseLandmark } from "@mefitzgerald/expo-pose-detection";
import type { Pose as StreamPose } from "react-native-esanusi-sensor-pose";
import type { ExerciseId } from "@/data/exercises";
import { ExerciseRepDetector, type MoveStatus } from "@/services/exerciseRepDetection";
import {
  detectPoseFromImageUri,
  isExerciseEmulator,
  isStreamPoseAvailable,
} from "@/services/exercisePoseNative";
import { streamPoseToLandmarks } from "@/services/exercisePoseLandmarks";
import {
  exercisePoseConfidence,
  isPoseOrientationReady,
  normalizePoseLandmarks,
  resetPoseCoordOrientation,
  type FrameOrientation,
} from "@/services/exercisePoseCoords";
import {
  PoseExerciseRepDetector,
  type PoseDetectionHint,
} from "@/services/exercisePoseRepDetection";
import {
  evaluatePoseFormQuality,
  workoutStatusLine,
  type PoseFormQuality,
} from "@/services/exercisePoseFormQuality";
import { PoseLandmarkSmoother } from "@/utils/poseLandmarkSmoothing";

/** Legacy still-capture loop (emulator / fallback). */
const LEGACY_POSE_GAP_MS = 1100;
const MOTION_FRAME_GAP_MS = 900;
const EMULATOR_MOTION_FRAME_GAP_MS = 2000;
const CAMERA_WARMUP_MS = 500;
/** Skeleton overlay refresh — ~60fps for snappier joints. */
const SQUAT_SKELETON_UI_MS = 16;
/** Ignore duplicate onRep callbacks — keep short so fast jacks are not dropped. */
const REP_UI_DEBOUNCE_MS = 150;
/** Don't advance the rep state machine on unreliable key joints (cross-phone noise). */
const MIN_REP_CONFIDENCE = 0.28;

export type ExerciseDetectionMode = "stream" | "pose" | "motion";

export type PoseOverlayState = {
  /** Landmarks in ML Kit upright content space (not selfie-mirrored). */
  landmarks: PoseLandmark[];
  contentWidth: number;
  contentHeight: number;
};

type Options = {
  enabled: boolean;
  exerciseId: ExerciseId;
  cameraRef: React.RefObject<CameraView | null>;
  onRep: () => void;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function triggerRepFeedback() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
}

export function useExerciseRepDetector({ enabled, exerciseId, cameraRef, onRep }: Options) {
  const streamMode = isStreamPoseAvailable();
  const [moveStatus, setMoveStatus] = useState<MoveStatus>("Stopped");
  const [poseHint, setPoseHint] = useState<PoseDetectionHint>(null);
  const [detectionMode, setDetectionMode] = useState<ExerciseDetectionMode>(
    streamMode ? "stream" : isExerciseEmulator() ? "motion" : "pose",
  );
  const [poseOverlay, setPoseOverlay] = useState<PoseOverlayState | null>(null);
  const [formQuality, setFormQuality] = useState<PoseFormQuality>("none");
  const [formMessage, setFormMessage] = useState("");

  const motionDetectorRef = useRef<ExerciseRepDetector | null>(null);
  const poseDetectorRef = useRef<PoseExerciseRepDetector | null>(null);
  const smootherRef = useRef(new PoseLandmarkSmoother());
  const modeRef = useRef<ExerciseDetectionMode>(streamMode ? "stream" : "motion");
  const lastRepAtRef = useRef(0);
  const onRepRef = useRef(onRep);
  const poseFailuresRef = useRef(0);
  const lastStatusRef = useRef<MoveStatus>("Stopped");
  const lastHintRef = useRef<PoseDetectionHint>(null);
  const lastQualityRef = useRef<PoseFormQuality>("none");
  const lastMessageRef = useRef("");
  const lastLandmarksRef = useRef<PoseLandmark[] | null>(null);
  const lastSkeletonUiAtRef = useRef(0);
  const showPoseSkeleton =
    exerciseId === "squats" || exerciseId === "arm_stretching" || exerciseId === "jumping_jacks";
  onRepRef.current = onRep;

  const publishHud = useCallback(
    (
      status: MoveStatus,
      hint: PoseDetectionHint | null,
      quality: PoseFormQuality,
      message: string,
    ) => {
      if (
        status === lastStatusRef.current &&
        hint === lastHintRef.current &&
        quality === lastQualityRef.current &&
        message === lastMessageRef.current
      ) {
        return;
      }

      lastStatusRef.current = status;
      lastHintRef.current = hint;
      lastQualityRef.current = quality;
      lastMessageRef.current = message;

      // One React commit — constant setState spam was freezing the camera preview.
      unstable_batchedUpdates(() => {
        setMoveStatus(status);
        setPoseHint(hint);
        setFormQuality(quality);
        setFormMessage(message);
      });
    },
    [],
  );

  const handleRep = useCallback(() => {
    const now = Date.now();
    if (now - lastRepAtRef.current < REP_UI_DEBOUNCE_MS) return;
    lastRepAtRef.current = now;
    triggerRepFeedback();
    onRepRef.current();
  }, []);

  const processLandmarks = useCallback(
    (
      raw: PoseLandmark[] | null,
      frameWidth: number,
      frameHeight: number,
      orientation: FrameOrientation = "portrait",
    ) => {
      if (!raw?.length) {
        poseFailuresRef.current += 1;
        lastLandmarksRef.current = null;
        if (poseFailuresRef.current >= 30 && modeRef.current === "stream") {
          poseDetectorRef.current?.reset();
        }
        if (showPoseSkeleton) setPoseOverlay(null);
        publishHud("Watching", "Stand in the frame", "red", "Stand in the frame");
        return;
      }

      poseFailuresRef.current = 0;

      // Landmarks stay in ML Kit / buffer space. Overlay mirrors X in math for selfie.
      const oriented = normalizePoseLandmarks(raw, frameWidth, frameHeight, orientation);
      // Smooth before detection — raw jitter on some phones was faking full reps.
      const normalized = smootherRef.current.smooth(oriented.landmarks);

      if (!isPoseOrientationReady()) {
        lastLandmarksRef.current = normalized;
        publishHud("Watching", "Stand in the frame", "red", "Stand in the frame");
        return;
      }

      if (exercisePoseConfidence(normalized, exerciseId) < MIN_REP_CONFIDENCE) {
        lastLandmarksRef.current = normalized;
        publishHud("Watching", "Need more light", "red", "Need more light");
        return;
      }

      const status = poseDetectorRef.current?.feed(normalized) ?? "Watching";
      const hint = poseDetectorRef.current?.getHint() ?? null;
      lastLandmarksRef.current = normalized;

      const form = evaluatePoseFormQuality(
        normalized,
        status,
        exerciseId,
        oriented.width,
        oriented.height,
        hint,
      );
      const quality = form.quality;
      const formMessageLine = workoutStatusLine(form, status, hint, exerciseId);

      const now = Date.now();
      const skeletonDue =
        showPoseSkeleton && now - lastSkeletonUiAtRef.current >= SQUAT_SKELETON_UI_MS;

      if (skeletonDue) {
        lastSkeletonUiAtRef.current = now;
        unstable_batchedUpdates(() => {
          setPoseOverlay({
            landmarks: normalized,
            contentWidth: oriented.width,
            contentHeight: oriented.height,
          });
          publishHud(status, hint, quality, formMessageLine);
        });
      } else {
        publishHud(status, hint, quality, formMessageLine);
      }
    },
    [exerciseId, publishHud, showPoseSkeleton],
  );

  const feedStreamPose = useCallback(
    (
      pose: StreamPose | null,
      frame: { width: number; height: number; orientation?: FrameOrientation },
    ) => {
      if (!enabled || modeRef.current !== "stream") return;
      processLandmarks(
        streamPoseToLandmarks(pose),
        frame.width,
        frame.height,
        frame.orientation ?? "portrait",
      );
    },
    [enabled, processLandmarks],
  );

  const switchToMotion = useCallback(() => {
    if (!isExerciseEmulator()) {
      publishHud("Watching", null, "red", "Step back into the frame");
      return;
    }
    if (modeRef.current === "motion") return;
    modeRef.current = "motion";
    setDetectionMode("motion");
    poseDetectorRef.current?.reset();
    smootherRef.current.reset();
    resetPoseCoordOrientation();
    setPoseOverlay(null);
    lastLandmarksRef.current = null;
    publishHud("Watching", null, "red", "Emulator motion mode — move in front of camera");
  }, [publishHud]);

  useEffect(() => {
    motionDetectorRef.current = new ExerciseRepDetector(exerciseId, handleRep);
    poseDetectorRef.current = new PoseExerciseRepDetector(exerciseId, handleRep);
    poseFailuresRef.current = 0;
    smootherRef.current.reset();
    resetPoseCoordOrientation();
    setPoseOverlay(null);
    lastSkeletonUiAtRef.current = 0;
    modeRef.current = streamMode ? "stream" : isExerciseEmulator() ? "motion" : "pose";
    setDetectionMode(modeRef.current);
    return () => {
      motionDetectorRef.current = null;
      poseDetectorRef.current = null;
    };
  }, [exerciseId, handleRep, streamMode]);

  useEffect(() => {
    if (!enabled) {
      motionDetectorRef.current?.reset();
      poseDetectorRef.current?.reset();
      smootherRef.current.reset();
      resetPoseCoordOrientation();
      lastStatusRef.current = "Stopped";
      lastHintRef.current = null;
      lastQualityRef.current = "none";
      lastMessageRef.current = "";
      lastLandmarksRef.current = null;
      unstable_batchedUpdates(() => {
        setMoveStatus("Stopped");
        setPoseHint(null);
        setPoseOverlay(null);
        setFormQuality("none");
        setFormMessage("");
      });
      return;
    }

    if (detectionMode === "stream") {
      publishHud("Watching", null, "red", "");
      return;
    }

    let cancelled = false;
    publishHud("Watching", null, "red", "");

    const runLoop = async () => {
      await sleep(CAMERA_WARMUP_MS);
      while (!cancelled) {
        const loopStart = Date.now();
        const usePose = modeRef.current === "pose";
        const gapMs = usePose
          ? LEGACY_POSE_GAP_MS
          : isExerciseEmulator()
            ? EMULATOR_MOTION_FRAME_GAP_MS
            : MOTION_FRAME_GAP_MS;

        if (!cameraRef.current) {
          await sleep(200);
          continue;
        }

        try {
          const photo = await cameraRef.current.takePictureAsync({
            quality: usePose ? 0.15 : 0.12,
            base64: !usePose,
            skipProcessing: true,
            shutterSound: false,
          });
          if (cancelled || !photo) {
            await sleep(gapMs);
            continue;
          }

          const frameWidth = photo.width ?? 720;
          const frameHeight = photo.height ?? 1280;

          if (usePose && photo.uri) {
            const landmarks = await detectPoseFromImageUri(photo.uri);
            if (cancelled) continue;
            if (!landmarks) {
              poseFailuresRef.current += 1;
              if (poseFailuresRef.current >= 4) switchToMotion();
              processLandmarks(null, frameWidth, frameHeight);
            } else {
              processLandmarks(landmarks, frameWidth, frameHeight);
            }
          } else {
            if (photo.uri) {
              void deleteAsync(photo.uri, { idempotent: true }).catch(() => undefined);
            }
            if (photo.base64) {
              const status = motionDetectorRef.current?.feedFrame(photo.base64) ?? "Watching";
              publishHud(
                status,
                null,
                status === "Move!" || status === "Rep!" ? "green" : "red",
                isExerciseEmulator()
                  ? "Emulator motion mode — move in front of camera"
                  : "Camera tracking unavailable — rebuild the app",
              );
            }
          }
        } catch {
          await sleep(400);
        }

        const elapsed = Date.now() - loopStart;
        await sleep(Math.max(0, gapMs - elapsed));
      }
    };

    void runLoop();

    return () => {
      cancelled = true;
      motionDetectorRef.current?.reset();
      poseDetectorRef.current?.reset();
    };
  }, [cameraRef, detectionMode, enabled, exerciseId, processLandmarks, publishHud, switchToMotion]);

  return {
    moveStatus,
    poseHint,
    detectionMode,
    isEmulator: isExerciseEmulator(),
    useStreamPose: detectionMode === "stream",
    useLegacyCamera: detectionMode !== "stream",
    poseOverlay,
    formQuality,
    formMessage,
    feedStreamPose,
  };
}
