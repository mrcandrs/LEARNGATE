import type { ExerciseId } from "@/data/exercises";
import type { PoseLandmark } from "@mefitzgerald/expo-pose-detection";
import { isFullBodyExercise } from "@/services/exerciseFrameBounds";
import { toNormY, portraitDims } from "@/services/exercisePoseCoordSpace";

const LM = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;

const MIN_KNEE = 0.27;
const MIN_HIP = 0.26;
const MIN_ANKLE = 0.24;

function pick(
  landmarks: PoseLandmark[],
  type: number,
  min: number,
): PoseLandmark | null {
  const lm = landmarks.find((l) => l.type === type);
  if (!lm || lm.inFrameLikelihood < min) return null;
  return lm;
}

export type LegGateResult = {
  ok: boolean;
  message: string;
};

export function evaluateLegGate(
  landmarks: PoseLandmark[],
  exerciseId: ExerciseId,
  frameWidth: number,
  frameHeight: number,
): LegGateResult {
  if (exerciseId === "jumping_jacks") {
    return { ok: true, message: "" };
  }

  const ls = pick(landmarks, LM.LEFT_SHOULDER, 0.24);
  const rs = pick(landmarks, LM.RIGHT_SHOULDER, 0.24);
  const lh = pick(landmarks, LM.LEFT_HIP, MIN_HIP);
  const rh = pick(landmarks, LM.RIGHT_HIP, MIN_HIP);
  const lk = pick(landmarks, LM.LEFT_KNEE, MIN_KNEE);
  const rk = pick(landmarks, LM.RIGHT_KNEE, MIN_KNEE);

  if (!ls || !rs) {
    return { ok: false, message: "Step back — fit head to knees in border" };
  }
  if (!lh || !rh) {
    return { ok: false, message: "Step back — show your hips" };
  }
  if (!lk || !rk) {
    return { ok: false, message: "Step back — show both knees" };
  }

  const torso = Math.abs(((lh.y + rh.y) / 2) - (ls.y + rs.y) / 2);
  const minGap = torso > 1e-4 ? torso * 0.12 : 0.015;
  if (lk.y < lh.y + minGap || rk.y < rh.y + minGap) {
    return { ok: false, message: "Frame your full body in the border" };
  }

  const { height: ph } = portraitDims(frameWidth, frameHeight);
  const kneeMidY = (toNormY(lk.y, ph, landmarks) + toNormY(rk.y, ph, landmarks)) / 2;
  const kneeMin = isFullBodyExercise(exerciseId) ? 0.3 : 0.38;
  if (kneeMidY < kneeMin) {
    return { ok: false, message: "Step back — knees need to be visible" };
  }

  const shoulderMidY = (toNormY(ls.y, ph, landmarks) + toNormY(rs.y, ph, landmarks)) / 2;
  if (shoulderMidY > 0.42) {
    return { ok: false, message: "Step back more — show your head" };
  }

  return { ok: true, message: "" };
}

/** Hip–knee–ankle flexion when ankles visible. */
export function kneeFlexionAngles(landmarks: PoseLandmark[]): number[] {
  const angles: number[] = [];
  const lh = pick(landmarks, LM.LEFT_HIP, MIN_HIP);
  const rh = pick(landmarks, LM.RIGHT_HIP, MIN_HIP);
  const lk = pick(landmarks, LM.LEFT_KNEE, MIN_KNEE);
  const rk = pick(landmarks, LM.RIGHT_KNEE, MIN_KNEE);
  const la = pick(landmarks, LM.LEFT_ANKLE, MIN_ANKLE);
  const ra = pick(landmarks, LM.RIGHT_ANKLE, MIN_ANKLE);

  if (lh && lk && la) angles.push(angleAt(lh, lk, la));
  if (rh && rk && ra) angles.push(angleAt(rh, rk, ra));
  return angles;
}

/** Thigh angle from vertical — works without ankles (front camera). */
export function thighBendProxies(landmarks: PoseLandmark[]): number[] {
  const proxies: number[] = [];
  const lh = pick(landmarks, LM.LEFT_HIP, MIN_HIP);
  const rh = pick(landmarks, LM.RIGHT_HIP, MIN_HIP);
  const lk = pick(landmarks, LM.LEFT_KNEE, MIN_KNEE);
  const rk = pick(landmarks, LM.RIGHT_KNEE, MIN_KNEE);
  if (lh && lk) proxies.push(thighBendFromVertical(lh, lk));
  if (rh && rk) proxies.push(thighBendFromVertical(rh, rk));
  return proxies;
}

function thighBendFromVertical(hip: PoseLandmark, knee: PoseLandmark): number {
  const dx = knee.x - hip.x;
  const dy = Math.max(knee.y - hip.y, 1e-4);
  const fromVertical = (Math.atan2(Math.abs(dx), dy) * 180) / Math.PI;
  return fromVertical * 2.4;
}

function angleAt(a: PoseLandmark, b: PoseLandmark, c: PoseLandmark): number {
  const bax = a.x - b.x;
  const bay = a.y - b.y;
  const bcx = c.x - b.x;
  const bcy = c.y - b.y;
  const mag = Math.hypot(bax, bay) * Math.hypot(bcx, bcy);
  if (mag < 1e-6) return 180;
  const cos = Math.max(-1, Math.min(1, (bax * bcx + bay * bcy) / mag));
  return (Math.acos(cos) * 180) / Math.PI;
}

export function hipDropRatio(
  landmarks: PoseLandmark[],
  baselineHipY: number,
  torsoLen: number,
): number | null {
  const lh = pick(landmarks, LM.LEFT_HIP, MIN_HIP);
  const rh = pick(landmarks, LM.RIGHT_HIP, MIN_HIP);
  if (!lh || !rh || torsoLen < 1e-4) return null;
  const hipY = (lh.y + rh.y) / 2;
  return (hipY - baselineHipY) / torsoLen;
}

export function legExtensionRatios(
  landmarks: PoseLandmark[],
  torsoLen: number,
): { left: number; right: number } | null {
  const lh = pick(landmarks, LM.LEFT_HIP, MIN_HIP);
  const rh = pick(landmarks, LM.RIGHT_HIP, MIN_HIP);
  const lk = pick(landmarks, LM.LEFT_KNEE, MIN_KNEE);
  const rk = pick(landmarks, LM.RIGHT_KNEE, MIN_KNEE);
  if (!lh || !rh || !lk || !rk || torsoLen < 1e-4) return null;
  return {
    left: (lk.y - lh.y) / torsoLen,
    right: (rk.y - rh.y) / torsoLen,
  };
}

export function snapshotTorso(
  landmarks: PoseLandmark[],
): { shoulderY: number; hipY: number; kneeY: number | null; torsoLen: number } | null {
  const ls = pick(landmarks, LM.LEFT_SHOULDER, 0.24);
  const rs = pick(landmarks, LM.RIGHT_SHOULDER, 0.24);
  const lh = pick(landmarks, LM.LEFT_HIP, MIN_HIP);
  const rh = pick(landmarks, LM.RIGHT_HIP, MIN_HIP);
  const lk = pick(landmarks, LM.LEFT_KNEE, MIN_KNEE);
  const rk = pick(landmarks, LM.RIGHT_KNEE, MIN_KNEE);
  if (!ls || !rs || !lh || !rh) return null;

  const shoulderY = (ls.y + rs.y) / 2;
  const hipY = (lh.y + rh.y) / 2;
  const kneeY = lk && rk ? (lk.y + rk.y) / 2 : null;
  return { shoulderY, hipY, kneeY, torsoLen: Math.max(hipY - shoulderY, 1e-4) };
}
