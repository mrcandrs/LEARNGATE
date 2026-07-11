import type { PoseLandmark } from "@mefitzgerald/expo-pose-detection";
import { exerciseFrameBoundsNormalized } from "@/services/exerciseFrameBounds";
import type { ExerciseId } from "@/data/exercises";
import {
  landmarksUseNormalizedCoords,
  portraitDims,
  toNormX,
  toNormY,
} from "@/services/exercisePoseCoordSpace";

/** If head is below hips in data, flip Y so detection matches portrait preview. */
function ensureUprightY(landmarks: PoseLandmark[]): PoseLandmark[] {
  const nose = landmarks.find((l) => l.type === 0);
  const lh = landmarks.find((l) => l.type === 23);
  const rh = landmarks.find((l) => l.type === 24);
  const hipY = lh && rh ? (lh.y + rh.y) / 2 : lh?.y ?? rh?.y;
  if (!nose || hipY == null) return landmarks;

  if (nose.y < hipY) return landmarks;

  const ys = landmarks.map((l) => l.y);
  const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
  return landmarks.map((l) => ({ ...l, y: 2 * mid - l.y }));
}

/**
 * Map stream buffer coords → portrait space (head up, y grows downward).
 */
export function normalizePoseLandmarks(
  landmarks: PoseLandmark[],
  frameWidth: number,
  frameHeight: number,
): PoseLandmark[] {
  const mapped = landmarks.map((lm) => {
    if (frameWidth > frameHeight) {
      return { ...lm, x: lm.y, y: frameWidth - lm.x };
    }
    return lm;
  });

  return ensureUprightY(mapped);
}

export function averagePoseConfidence(landmarks: PoseLandmark[] | null): number {
  if (!landmarks?.length) return 0;
  const core = landmarks.filter((lm) =>
    [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26].includes(lm.type),
  );
  const sample = core.length ? core : landmarks;
  return sample.reduce((sum, lm) => sum + lm.inFrameLikelihood, 0) / sample.length;
}

function bodyCenterNormalized(
  landmarks: PoseLandmark[],
  frameWidth: number,
  frameHeight: number,
): { cx: number; cy: number } | null {
  const normalized = normalizePoseLandmarks(landmarks, frameWidth, frameHeight);
  const { width: pw, height: ph } = portraitDims(frameWidth, frameHeight);

  const ls = normalized.find((l) => l.type === 11 && l.inFrameLikelihood >= 0.2);
  const rs = normalized.find((l) => l.type === 12 && l.inFrameLikelihood >= 0.2);
  const lh = normalized.find((l) => l.type === 23 && l.inFrameLikelihood >= 0.2);
  const rh = normalized.find((l) => l.type === 24 && l.inFrameLikelihood >= 0.2);
  const nose = normalized.find((l) => l.type === 0 && l.inFrameLikelihood >= 0.2);

  const points = [ls, rs, lh, rh, nose].filter(Boolean) as PoseLandmark[];
  if (points.length < 2) return null;

  const normalizedSpace = landmarksUseNormalizedCoords(normalized);
  const cx =
    points.reduce((s, p) => s + (normalizedSpace ? p.x : toNormX(p.x, pw, normalized)), 0) /
    points.length;
  const cy =
    points.reduce((s, p) => s + (normalizedSpace ? p.y : toNormY(p.y, ph, normalized)), 0) /
    points.length;
  return { cx, cy };
}

/** Is the detected body roughly inside the on-screen frame? */
export function isBodyInFrame(
  landmarks: PoseLandmark[],
  frameWidth: number,
  frameHeight: number,
  exerciseId?: ExerciseId,
): boolean {
  const center = bodyCenterNormalized(landmarks, frameWidth, frameHeight);
  if (!center) return false;

  const bounds = exerciseFrameBoundsNormalized(exerciseId);
  return (
    center.cx >= bounds.left &&
    center.cx <= bounds.right &&
    center.cy >= bounds.top &&
    center.cy <= bounds.bottom
  );
}
