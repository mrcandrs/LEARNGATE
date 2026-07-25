import type { PoseLandmark } from "@mefitzgerald/expo-pose-detection";
import {
  landmarksUseNormalizedCoords,
  toNormX,
  toNormY,
} from "@/services/exercisePoseCoordSpace";

export type OrientedPose = {
  landmarks: PoseLandmark[];
  width: number;
  height: number;
};

export type FrameOrientation =
  | "portrait"
  | "portrait-upside-down"
  | "landscape-left"
  | "landscape-right";

/**
 * Sticky upright decision.
 * Default flip=true for this VisionCamera+ML Kit path (unflipped draws upside-down).
 * Locked after a clear head+hips frame — never re-flips when you step close.
 */
let uprightDecided = false;
let needYFlip = true;

export function resetPoseCoordOrientation() {
  uprightDecided = false;
  needYFlip = true;
}

export function mlKitContentSize(
  frameWidth: number,
  frameHeight: number,
  orientation: FrameOrientation,
): { width: number; height: number } {
  if (orientation === "landscape-left" || orientation === "landscape-right") {
    return { width: frameHeight, height: frameWidth };
  }
  return { width: frameWidth, height: frameHeight };
}

export function mirrorPoseLandmarks(
  landmarks: PoseLandmark[],
  contentWidth: number,
): PoseLandmark[] {
  const normalized = landmarksUseNormalizedCoords(landmarks);
  return landmarks.map((lm) => ({
    ...lm,
    x: normalized ? 1 - lm.x : contentWidth - lm.x,
  }));
}

/** Flip against the image height — NOT the body midpoint (midpoint warp missed the joints). */
function flipYLandmarks(landmarks: PoseLandmark[], contentHeight: number): PoseLandmark[] {
  const normalized = landmarksUseNormalizedCoords(landmarks);
  return landmarks.map((lm) => ({
    ...lm,
    y: normalized ? 1 - lm.y : contentHeight - lm.y,
  }));
}

function pickVisible(
  landmarks: PoseLandmark[],
  type: number,
  min = 0.35,
): PoseLandmark | null {
  const lm = landmarks.find((l) => l.type === type);
  if (!lm || lm.inFrameLikelihood < min) return null;
  return lm;
}

function maybeDecideUpright(landmarks: PoseLandmark[]) {
  if (uprightDecided) return;

  const nose = pickVisible(landmarks, 0, 0.4);
  const ls = pickVisible(landmarks, 11, 0.4);
  const rs = pickVisible(landmarks, 12, 0.4);
  const lh = pickVisible(landmarks, 23, 0.4);
  const rh = pickVisible(landmarks, 24, 0.4);
  if (!nose || !lh || !rh) return;
  if (!ls && !rs) return;

  needYFlip = nose.y > (lh.y + rh.y) / 2;
  uprightDecided = true;
}

export function normalizePoseLandmarks(
  landmarks: PoseLandmark[],
  frameWidth: number,
  frameHeight: number,
  orientation: FrameOrientation = "portrait",
): OrientedPose {
  const { width, height } = mlKitContentSize(frameWidth, frameHeight, orientation);

  maybeDecideUpright(landmarks);

  const out = needYFlip ? flipYLandmarks(landmarks, height) : landmarks;
  return { landmarks: out, width, height };
}

export function averagePoseConfidence(landmarks: PoseLandmark[] | null): number {
  if (!landmarks?.length) return 0;
  const core = landmarks.filter((lm) =>
    [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26].includes(lm.type),
  );
  const sample = core.length ? core : landmarks;
  return sample.reduce((sum, lm) => sum + lm.inFrameLikelihood, 0) / sample.length;
}

/** Map landmark → preview with resizeMode "cover". */
export function mapLandmarkToPreview(
  lm: PoseLandmark,
  contentWidth: number,
  contentHeight: number,
  viewWidth: number,
  viewHeight: number,
  allLandmarks?: PoseLandmark[],
  mirrorX = false,
): { x: number; y: number } | null {
  if (contentWidth <= 0 || contentHeight <= 0 || viewWidth <= 0 || viewHeight <= 0) return null;

  const sample = allLandmarks?.length ? allLandmarks : [lm];
  const nx0 = toNormX(lm.x, contentWidth, sample);
  const ny = toNormY(lm.y, contentHeight, sample);
  if (!Number.isFinite(nx0) || !Number.isFinite(ny)) return null;
  const nx = mirrorX ? 1 - nx0 : nx0;

  const scale = Math.max(viewWidth / contentWidth, viewHeight / contentHeight);
  const drawnW = contentWidth * scale;
  const drawnH = contentHeight * scale;
  const offX = (viewWidth - drawnW) / 2;
  const offY = (viewHeight - drawnH) / 2;

  return {
    x: nx * drawnW + offX,
    y: ny * drawnH + offY,
  };
}

export function mapLandmarkToView(
  lm: PoseLandmark,
  frameWidth: number,
  frameHeight: number,
  viewWidth: number,
  viewHeight: number,
  _mirrored = false,
  allLandmarks?: PoseLandmark[],
): { x: number; y: number } | null {
  return mapLandmarkToPreview(lm, frameWidth, frameHeight, viewWidth, viewHeight, allLandmarks);
}

export function isBodyInFrame(
  landmarks: PoseLandmark[],
  frameWidth: number,
  frameHeight: number,
  _exerciseId?: string,
): boolean {
  if (!landmarks.length || frameWidth <= 0 || frameHeight <= 0) return false;
  const sample = landmarks;
  const pts = landmarks.filter(
    (l) => [0, 11, 12, 23, 24].includes(l.type) && l.inFrameLikelihood >= 0.2,
  );
  if (pts.length < 2) return false;
  const norm = landmarksUseNormalizedCoords(sample);
  const cx =
    pts.reduce((s, p) => s + (norm ? p.x : toNormX(p.x, frameWidth, sample)), 0) / pts.length;
  const cy =
    pts.reduce((s, p) => s + (norm ? p.y : toNormY(p.y, frameHeight, sample)), 0) / pts.length;
  return cx > 0.05 && cx < 0.95 && cy > 0.05 && cy < 0.95;
}
