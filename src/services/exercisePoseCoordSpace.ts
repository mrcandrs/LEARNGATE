import type { PoseLandmark } from "@mefitzgerald/expo-pose-detection";

/** ML Kit may return 0–1 normalized or pixel coords — detect once per frame. */
export function landmarksUseNormalizedCoords(landmarks: PoseLandmark[]): boolean {
  let max = 0;
  for (const lm of landmarks) {
    if (lm.x > max) max = lm.x;
    if (lm.y > max) max = lm.y;
  }
  return max <= 1.5;
}

export function toNormX(x: number, frameWidth: number, landmarks: PoseLandmark[]): number {
  return landmarksUseNormalizedCoords(landmarks) ? x : x / frameWidth;
}

export function toNormY(y: number, frameHeight: number, landmarks: PoseLandmark[]): number {
  return landmarksUseNormalizedCoords(landmarks) ? y : y / frameHeight;
}

export function portraitDims(frameWidth: number, frameHeight: number): { width: number; height: number } {
  return frameWidth > frameHeight
    ? { width: frameHeight, height: frameWidth }
    : { width: frameWidth, height: frameHeight };
}
