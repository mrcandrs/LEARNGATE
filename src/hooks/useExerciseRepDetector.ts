import { useCallback, useEffect, useRef, useState } from "react";
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
import { normalizePoseLandmarks } from "@/services/exercisePoseCoords";
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
/** Throttle overlay React updates — detection + smoothing run every frame. */
const OVERLAY_UI_MS = 33;

export type ExerciseDetectionMode = "stream" | "pose" | "motion";

export type PoseOverlayState = {
  landmarks: PoseLandmark[];
  frameWidth: number;
  frameHeight: number;
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
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
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
  const onRepRef = useRef(onRep);
  const poseFailuresRef = useRef(0);
  const lastStatusRef = useRef<MoveStatus>("Stopped");
  const lastHintRef = useRef<PoseDetectionHint>(null);
  const lastLandmarksRef = useRef<PoseLandmark[] | null>(null);
  const lastOverlayUiAtRef = useRef(0);
  onRepRef.current = onRep;

  const setStatusIfChanged = useCallback((status: MoveStatus) => {
    if (lastStatusRef.current === status) return;
    lastStatusRef.current = status;
    setMoveStatus(status);
  }, []);

  const setHintIfChanged = useCallback((hint: PoseDetectionHint) => {
    if (lastHintRef.current === hint) return;
    lastHintRef.current = hint;
    setPoseHint(hint);
  }, []);

  const updateFormFeedback = useCallback(
    (
      landmarks: PoseLandmark[] | null,
      status: MoveStatus,
      hint: PoseDetectionHint | null,
      frameWidth: number,
      frameHeight: number,
    ) => {
      const form = evaluatePoseFormQuality(
        landmarks,
        status,
        exerciseId,
        frameWidth,
        frameHeight,
      );
      setFormQuality(form.quality);
      setFormMessage(workoutStatusLine(form, status, hint));
    },
    [exerciseId],
  );

  const handleRep = useCallback(() => {
    triggerRepFeedback();
    onRepRef.current();
    setStatusIfChanged("Rep!");
    setTimeout(() => {
      if (lastStatusRef.current === "Rep!") setStatusIfChanged("Watching");
    }, 700);
  }, [setStatusIfChanged]);

  const processLandmarks = useCallback(
    (raw: PoseLandmark[] | null, frameWidth: number, frameHeight: number) => {
      if (!raw?.length) {
        poseFailuresRef.current += 1;
        lastLandmarksRef.current = null;
        if (poseFailuresRef.current >= 30 && modeRef.current === "stream") {
          modeRef.current = "pose";
          setDetectionMode("pose");
          poseDetectorRef.current?.reset();
        }
        setPoseOverlay(null);
        setStatusIfChanged("Watching");
        setHintIfChanged("Stand inside the frame");
        updateFormFeedback(null, "Watching", "Stand inside the frame", frameWidth, frameHeight);
        return;
      }

      poseFailuresRef.current = 0;
      const normalized =
        modeRef.current === "stream"
          ? normalizePoseLandmarks(raw, frameWidth, frameHeight)
          : raw;
      const status =
        poseDetectorRef.current?.feed(normalized, frameWidth, frameHeight) ?? "Watching";
      const hint = poseDetectorRef.current?.getHint() ?? null;
      lastLandmarksRef.current = normalized;

      const now = Date.now();
      if (now - lastOverlayUiAtRef.current >= OVERLAY_UI_MS || status === "Rep!") {
        lastOverlayUiAtRef.current = now;
        setStatusIfChanged(status);
        setHintIfChanged(hint);
        updateFormFeedback(normalized, status, hint, frameWidth, frameHeight);
      }
    },
    [setHintIfChanged, setStatusIfChanged, updateFormFeedback],
  );

  const feedStreamPose = useCallback(
    (pose: StreamPose | null, frame: { width: number; height: number }) => {
      if (!enabled || modeRef.current !== "stream") return;
      processLandmarks(streamPoseToLandmarks(pose), frame.width, frame.height);
    },
    [enabled, processLandmarks],
  );

  const switchToMotion = useCallback(() => {
    if (modeRef.current === "motion") return;
    modeRef.current = "motion";
    setDetectionMode("motion");
    poseDetectorRef.current?.reset();
    smootherRef.current.reset();
    setPoseOverlay(null);
    lastLandmarksRef.current = null;
    setFormQuality("partial");
    setFormMessage("Using motion mode — step back so we can see you move");
  }, []);

  useEffect(() => {
    motionDetectorRef.current = new ExerciseRepDetector(exerciseId, handleRep);
    poseDetectorRef.current = new PoseExerciseRepDetector(exerciseId, handleRep);
    poseFailuresRef.current = 0;
    smootherRef.current.reset();
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
      lastStatusRef.current = "Stopped";
      lastHintRef.current = null;
      lastLandmarksRef.current = null;
      lastOverlayUiAtRef.current = 0;
      setMoveStatus("Stopped");
      setPoseHint(null);
      setPoseOverlay(null);
      setFormQuality("none");
      setFormMessage("");
      return;
    }

    if (detectionMode === "stream") {
      setStatusIfChanged("Watching");
      setHintIfChanged(null);
      return;
    }

    let cancelled = false;
    setStatusIfChanged("Watching");
    setHintIfChanged(null);

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
              setStatusIfChanged(status);
              setHintIfChanged(null);
              setFormQuality(status === "Move!" || status === "Rep!" ? "active" : "partial");
              setFormMessage(
                isExerciseEmulator()
                  ? "Emulator motion mode — move in front of camera"
                  : "Motion tracking — show shoulders and hips",
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
  }, [
    cameraRef,
    detectionMode,
    enabled,
    exerciseId,
    processLandmarks,
    setHintIfChanged,
    setStatusIfChanged,
    switchToMotion,
  ]);

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
