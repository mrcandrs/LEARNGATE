import { useEffect, useRef, useState } from "react";
import type { CameraView } from "expo-camera";
import type { ExerciseId } from "@/data/exercises";
import { ExerciseRepDetector, type MoveStatus } from "@/services/exerciseRepDetection";

const FRAME_INTERVAL_MS = 450;

type Options = {
  enabled: boolean;
  exerciseId: ExerciseId;
  cameraRef: React.RefObject<CameraView | null>;
  onRep: () => void;
};

export function useExerciseRepDetector({ enabled, exerciseId, cameraRef, onRep }: Options) {
  const [moveStatus, setMoveStatus] = useState<MoveStatus>("Stopped");
  const detectorRef = useRef<ExerciseRepDetector | null>(null);
  const onRepRef = useRef(onRep);
  onRepRef.current = onRep;

  useEffect(() => {
    detectorRef.current = new ExerciseRepDetector(exerciseId, () => {
      onRepRef.current();
      setMoveStatus("Rep!");
      setTimeout(() => setMoveStatus((s) => (s === "Rep!" ? "Watching" : s)), 900);
    });
    return () => {
      detectorRef.current = null;
    };
  }, [exerciseId]);

  useEffect(() => {
    if (!enabled) {
      detectorRef.current?.reset();
      setMoveStatus("Stopped");
      return;
    }

    setMoveStatus("Watching");
    let cancelled = false;

    const tick = async () => {
      if (cancelled || !cameraRef.current) return;
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.15,
          base64: true,
          skipProcessing: true,
          shutterSound: false,
        });
        if (cancelled || !photo?.base64) return;
        const status = detectorRef.current?.feedFrame(photo.base64) ?? "Watching";
        if (!cancelled) setMoveStatus(status);
      } catch {
        // Camera may still be warming up; ignore transient errors.
      }
    };

    void tick();
    const id = setInterval(() => void tick(), FRAME_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
      detectorRef.current?.reset();
    };
  }, [enabled, exerciseId, cameraRef]);

  return { moveStatus };
}
