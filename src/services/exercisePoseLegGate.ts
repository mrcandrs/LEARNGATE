/**
 * Exercise geometry for ML Kit BlazePose (phone front camera / half-body friendly).
 *
 * Half-body needs:
 * - Jumping jack: shoulders + wrists (arms)
 * - Squat: shoulders + hips + knees (hip drop / thigh bend)
 * - Lunge: hips + both knees (asymmetry)
 *
 * Ankles help when visible but are NOT required.
 */
import type { ExerciseId } from "@/data/exercises";
import type { PoseLandmark } from "@mefitzgerald/expo-pose-detection";

export const LM = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;

export const MIN_VISIBILITY = 0.25;

export type LegGateResult = {
  ok: boolean;
  message: string;
};

export function pick(
  landmarks: PoseLandmark[],
  type: number,
  min = MIN_VISIBILITY,
): PoseLandmark | null {
  const lm = landmarks.find((l) => l.type === type);
  if (!lm || lm.inFrameLikelihood < min) return null;
  return lm;
}

export function distance(a: PoseLandmark, b: PoseLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function angleDeg(a: PoseLandmark, b: PoseLandmark, c: PoseLandmark): number {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const mag1 = Math.hypot(abx, aby);
  const mag2 = Math.hypot(cbx, cby);
  if (mag1 === 0 || mag2 === 0) return 180;
  const cos = Math.max(-1, Math.min(1, (abx * cbx + aby * cby) / (mag1 * mag2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

export function avg(...values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Per-exercise minimum body (half-body OK). */
export function evaluateLegGate(
  landmarks: PoseLandmark[],
  exerciseId: ExerciseId,
  _frameWidth?: number,
  _frameHeight?: number,
): LegGateResult {
  const ls = pick(landmarks, LM.LEFT_SHOULDER);
  const rs = pick(landmarks, LM.RIGHT_SHOULDER);
  const lh = pick(landmarks, LM.LEFT_HIP);
  const rh = pick(landmarks, LM.RIGHT_HIP);
  const lk = pick(landmarks, LM.LEFT_KNEE);
  const rk = pick(landmarks, LM.RIGHT_KNEE);
  const lw = pick(landmarks, LM.LEFT_WRIST) ?? pick(landmarks, LM.LEFT_ELBOW);
  const rw = pick(landmarks, LM.RIGHT_WRIST) ?? pick(landmarks, LM.RIGHT_ELBOW);

  if (exerciseId === "jumping_jacks") {
    if (!(ls || rs)) {
      return { ok: false, message: "Show your shoulders in the border" };
    }
    if (!(lw && rw)) {
      return { ok: false, message: "Show both arms / hands" };
    }
    return { ok: true, message: "" };
  }

  // Squats & lunges — torso + knees; ankles optional
  if (!(ls || rs)) {
    return { ok: false, message: "Show your shoulders in the border" };
  }
  if (!(lh || rh)) {
    return { ok: false, message: "Step back a bit — show your hips" };
  }
  if (!(lk || rk)) {
    return { ok: false, message: "Step back — show at least one knee" };
  }
  if (exerciseId === "lunges" && !(lk && rk)) {
    return { ok: false, message: "Step back — show both knees for lunges" };
  }
  return { ok: true, message: "" };
}

export function hasCoreLandmarks(landmarks: PoseLandmark[]): boolean {
  return evaluateLegGate(landmarks, "squats").ok;
}

/** True hip–knee–ankle when ankles visible. */
export function bothKneeAngles(landmarks: PoseLandmark[]): { left: number; right: number } | null {
  const lh = pick(landmarks, LM.LEFT_HIP);
  const rh = pick(landmarks, LM.RIGHT_HIP);
  const lk = pick(landmarks, LM.LEFT_KNEE);
  const rk = pick(landmarks, LM.RIGHT_KNEE);
  const la = pick(landmarks, LM.LEFT_ANKLE);
  const ra = pick(landmarks, LM.RIGHT_ANKLE);

  if (lh && lk && la && rh && rk && ra) {
    return {
      left: angleDeg(lh, lk, la),
      right: angleDeg(rh, rk, ra),
    };
  }
  return null;
}

/**
 * Shoulder–hip–knee angle (works without ankles).
 * Smaller ≈ more bent (squat depth proxy).
 */
export function bothThighAngles(landmarks: PoseLandmark[]): { left: number; right: number } | null {
  const ls = pick(landmarks, LM.LEFT_SHOULDER);
  const rs = pick(landmarks, LM.RIGHT_SHOULDER);
  const lh = pick(landmarks, LM.LEFT_HIP);
  const rh = pick(landmarks, LM.RIGHT_HIP);
  const lk = pick(landmarks, LM.LEFT_KNEE);
  const rk = pick(landmarks, LM.RIGHT_KNEE);

  const left = ls && lh && lk ? angleDeg(ls, lh, lk) : null;
  const right = rs && rh && rk ? angleDeg(rs, rh, rk) : null;

  if (left != null && right != null) return { left, right };
  if (left != null) return { left, right: left };
  if (right != null) return { left: right, right };
  return null;
}

export function hipMidY(landmarks: PoseLandmark[]): number | null {
  const lh = pick(landmarks, LM.LEFT_HIP);
  const rh = pick(landmarks, LM.RIGHT_HIP);
  if (lh && rh) return avg(lh.y, rh.y);
  if (lh) return lh.y;
  if (rh) return rh.y;
  return null;
}

export function shoulderMidY(landmarks: PoseLandmark[]): number | null {
  const ls = pick(landmarks, LM.LEFT_SHOULDER);
  const rs = pick(landmarks, LM.RIGHT_SHOULDER);
  if (ls && rs) return avg(ls.y, rs.y);
  if (ls) return ls.y;
  if (rs) return rs.y;
  return null;
}

export function kneeMidY(landmarks: PoseLandmark[]): number | null {
  const lk = pick(landmarks, LM.LEFT_KNEE);
  const rk = pick(landmarks, LM.RIGHT_KNEE);
  if (lk && rk) return avg(lk.y, rk.y);
  if (lk) return lk.y;
  if (rk) return rk.y;
  return null;
}
