/**
 * Kids360-simple exercise counters for LearnGate.
 *
 * Traffic light:
 *   RED  = start the move
 *   GREEN = finish the move
 *   +1   = full cycle done
 *
 * Squats use a peak→trough hip detector so continuous bouncing still counts
 * (no need for a perfect upright lock every rep).
 */
import type { ExerciseId } from "@/data/exercises";
import type { PoseLandmark } from "@mefitzgerald/expo-pose-detection";
import type { MoveStatus } from "@/services/exerciseRepDetection";
import {
  LM,
  avg,
  bothThighAngles,
  distance,
  evaluateLegGate,
  pick,
} from "@/services/exercisePoseLegGate";
import { landmarksUseNormalizedCoords } from "@/services/exercisePoseCoordSpace";

const REP_COOLDOWN_MS = 450;

export type PoseDetectionHint =
  | null
  | "Stand in the border"
  | "Show your shoulders"
  | "Show both arms"
  | "Step back — show your hips"
  | "Step back — show a knee"
  | "Step back — show both knees"
  | "Arms up!"
  | "Arms down!"
  | "+1 Jumping jack!"
  | "Squat down!"
  | "Stand up!"
  | "+1 Squat!"
  | "Step into a lunge!"
  | "+1 Lunge!"
  | "Need more light";

export const READY_HINT: Record<ExerciseId, PoseDetectionHint> = {
  jumping_jacks: "Arms up!",
  squats: "Squat down!",
  lunges: "Step into a lunge!",
};

export const GO_HINT: Record<ExerciseId, PoseDetectionHint> = {
  jumping_jacks: "Arms down!",
  squats: "Stand up!",
  lunges: "Stand up!",
};

export function hasExercisePoseBody(landmarks: PoseLandmark[], exerciseId?: ExerciseId): boolean {
  return evaluateLegGate(landmarks, exerciseId ?? "squats").ok;
}

export function needsLegsInFrame(exerciseId?: ExerciseId): boolean {
  return exerciseId === "squats" || exerciseId === "lunges";
}

export class PoseExerciseRepDetector {
  private phase: "ready" | "active" = "ready";
  private lastRepAt = 0;
  private moveStatus: MoveStatus = "Stopped";
  private hint: PoseDetectionHint = null;
  private gateFailStreak = 0;
  private peakFrames = 0;
  private returnFrames = 0;

  /** Jacks / lunges standing scale. */
  private standTorso = 0;
  private standSamples = 0;

  /** Squat hysteresis: standing ↔ bottom (no long time-lock — that felt laggy). */
  private hipEma = 0;
  private standHipY = 0;
  private bottomHipY = 0;
  private standLocked = false;
  private squatDown = false;
  /** +1 hips-down-in-frame, -1 if device Y is inverted. */
  private squatSign = 1;

  constructor(
    private exerciseId: ExerciseId,
    private readonly onRep: () => void,
  ) {}

  reset() {
    this.phase = "ready";
    this.lastRepAt = 0;
    this.moveStatus = "Stopped";
    this.hint = null;
    this.gateFailStreak = 0;
    this.peakFrames = 0;
    this.returnFrames = 0;
    this.standTorso = 0;
    this.standSamples = 0;
    this.hipEma = 0;
    this.standHipY = 0;
    this.bottomHipY = 0;
    this.standLocked = false;
    this.squatDown = false;
    this.squatSign = 1;
  }

  setExerciseId(exerciseId: ExerciseId) {
    this.exerciseId = exerciseId;
    this.reset();
  }

  getStatus(): MoveStatus {
    return this.moveStatus;
  }

  getHint(): PoseDetectionHint {
    return this.hint;
  }

  feed(landmarks: PoseLandmark[]): MoveStatus {
    const gate = evaluateLegGate(landmarks, this.exerciseId);
    if (!gate.ok) {
      this.gateFailStreak += 1;
      if (this.phase === "active" && this.gateFailStreak < 18) {
        this.moveStatus = "Move!";
        this.hint = GO_HINT[this.exerciseId];
        return this.moveStatus;
      }
      this.resetSoft(gate.message as PoseDetectionHint);
      return this.moveStatus;
    }
    this.gateFailStreak = 0;

    switch (this.exerciseId) {
      case "jumping_jacks":
        return this.jacks(landmarks);
      case "squats":
        return this.squats(landmarks);
      case "lunges":
        return this.lunges(landmarks);
    }
  }

  private resetSoft(hint: PoseDetectionHint) {
    this.phase = "ready";
    this.peakFrames = 0;
    this.returnFrames = 0;
    this.standTorso = 0;
    this.standSamples = 0;
    this.hipEma = 0;
    this.standHipY = 0;
    this.bottomHipY = 0;
    this.standLocked = false;
    this.squatDown = false;
    this.squatSign = 1;
    this.moveStatus = "Watching";
    this.hint = hint || "Stand in the border";
  }

  private recordRep(hint: PoseDetectionHint) {
    const now = Date.now();
    if (now - this.lastRepAt < REP_COOLDOWN_MS) return false;
    this.lastRepAt = now;
    this.squatDown = false;
    this.peakFrames = 0;
    this.returnFrames = 0;
    this.onRep();
    this.moveStatus = "Rep!";
    this.hint = hint;
    this.phase = "ready";
    return true;
  }

  private ready(hint: PoseDetectionHint) {
    this.phase = "ready";
    this.moveStatus = "Watching";
    this.hint = hint;
    return this.moveStatus;
  }

  private active() {
    this.phase = "active";
    this.moveStatus = "Move!";
    this.hint = GO_HINT[this.exerciseId];
    return this.moveStatus;
  }

  /** Kids360-style jacks: arms up/wide → arms down. */
  private jacks(landmarks: PoseLandmark[]): MoveStatus {
    const ls = pick(landmarks, LM.LEFT_SHOULDER);
    const rs = pick(landmarks, LM.RIGHT_SHOULDER);
    const lw = pick(landmarks, LM.LEFT_WRIST) ?? pick(landmarks, LM.LEFT_ELBOW);
    const rw = pick(landmarks, LM.RIGHT_WRIST) ?? pick(landmarks, LM.RIGHT_ELBOW);
    if (!ls || !rs || !lw || !rw) return this.ready("Show both arms");

    const shoulderY = avg(ls.y, rs.y);
    const shoulderW = Math.max(distance(ls, rs), 1e-3);
    const wristY = avg(lw.y, rw.y);
    const spread = distance(lw, rw);

    const atPeak = wristY < shoulderY - shoulderW * 0.02 || spread > shoulderW * 1.15;
    const atRest =
      !atPeak && wristY > shoulderY - shoulderW * 0.1 && spread < shoulderW * 1.28;

    if (atPeak) {
      this.peakFrames += 1;
      if (this.peakFrames >= 1) return this.active();
    } else {
      this.peakFrames = 0;
    }

    if (this.phase === "active") {
      if (atRest) {
        this.returnFrames += 1;
        if (this.returnFrames >= 1) {
          this.recordRep("+1 Jumping jack!");
          return this.moveStatus;
        }
      } else {
        this.returnFrames = 0;
      }
      return this.active();
    }

    return this.ready("Arms up!");
  }

  /**
   * Squat with Schmitt-trigger hysteresis (Kids360-style):
   *   standing → drop past DOWN threshold → green
   *   bottom → rise under UP threshold → +1, back to standing
   * Next rep needs a fresh full drop (bounce cannot re-count).
   * Light EMA + 1-frame confirms keep it snappy.
   */
  private squats(landmarks: PoseLandmark[]): MoveStatus {
    const ls = pick(landmarks, LM.LEFT_SHOULDER, 0.08);
    const rs = pick(landmarks, LM.RIGHT_SHOULDER, 0.08);
    const lh = pick(landmarks, LM.LEFT_HIP, 0.08);
    const rh = pick(landmarks, LM.RIGHT_HIP, 0.08);
    if (!ls && !rs) {
      this.peakFrames = 0;
      return this.ready("Show your shoulders");
    }
    if (!lh && !rh) {
      this.peakFrames = 0;
      return this.ready("Step back — show your hips");
    }

    const shY = ls && rs ? avg(ls.y, rs.y) : (ls ?? rs)!.y;
    const hpY = lh && rh ? avg(lh.y, rh.y) : (lh ?? rh)!.y;
    const shoulderW =
      ls && rs ? Math.max(distance(ls, rs), 1e-3) : Math.max(Math.abs(hpY - shY), 1e-3);
    const torso = Math.max(Math.abs(hpY - shY), 1e-3);

    const thighs = bothThighAngles(landmarks);
    const thighAvg = thighs ? avg(thighs.left, thighs.right) : null;
    const thighBent = thighAvg != null && thighAvg < 138;
    const thighOpen = thighAvg == null || thighAvg > 150;

    // Light EMA — heavy smoothing was the main “lag” feel.
    this.hipEma = this.hipEma === 0 ? hpY : 0.4 * this.hipEma + 0.6 * hpY;

    const normalized = landmarksUseNormalizedCoords(landmarks);
    const downThresh = Math.max(
      this.standTorso > 0 ? this.standTorso * 0.12 : torso * 0.12,
      shoulderW * 0.2,
      normalized ? 0.035 : 24,
    );
    // Must rise clearly above the noise band before the next squat can arm.
    const upThresh = downThresh * 0.32;

    if (!this.standLocked) {
      this.standSamples += 1;
      this.standHipY =
        this.standSamples === 1 ? this.hipEma : 0.8 * this.standHipY + 0.2 * this.hipEma;
      this.standTorso =
        this.standSamples === 1 ? torso : 0.8 * this.standTorso + 0.2 * torso;
      if (this.standSamples < 5) return this.ready("Squat down!");
      this.standLocked = true;
    }

    const rawDrop = this.hipEma - this.standHipY; // + = down the frame

    if (!this.squatDown) {
      // Adapt standing only when idle near baseline.
      if (Math.abs(rawDrop) < upThresh && thighOpen) {
        this.standHipY = 0.94 * this.standHipY + 0.06 * this.hipEma;
        this.standTorso = 0.94 * this.standTorso + 0.06 * torso;
      }

      const downNormal = rawDrop > downThresh || (thighBent && rawDrop > downThresh * 0.5);
      const downInverted = rawDrop < -downThresh || (thighBent && rawDrop < -downThresh * 0.5);

      if (downNormal || downInverted) {
        this.squatDown = true;
        this.squatSign = downNormal ? 1 : -1;
        this.bottomHipY = this.hipEma;
        return this.active();
      }
      return this.ready("Squat down!");
    }

    // In the hole — track deepest point along squat direction.
    if (this.squatSign >= 0) {
      if (this.hipEma > this.bottomHipY) this.bottomHipY = this.hipEma;
    } else if (this.hipEma < this.bottomHipY) {
      this.bottomHipY = this.hipEma;
    }

    const signedDrop = this.squatSign * (this.hipEma - this.standHipY);
    const depth = Math.abs(this.bottomHipY - this.standHipY);
    // Hysteresis alone prevents bounce doubles — no thigh requirement on the way up.
    const roseEnough = depth >= downThresh * 0.85 && signedDrop < upThresh;

    if (roseEnough) {
      this.standHipY = 0.75 * this.standHipY + 0.25 * this.hipEma;
      this.standTorso = 0.75 * this.standTorso + 0.25 * torso;
      this.recordRep("+1 Squat!");
      return this.moveStatus;
    }

    return this.active();
  }

  /** Kids360-style lunge: knee height / thigh asymmetry. */
  private lunges(landmarks: PoseLandmark[]): MoveStatus {
    const lk = pick(landmarks, LM.LEFT_KNEE, 0.12);
    const rk = pick(landmarks, LM.RIGHT_KNEE, 0.12);
    const ls = pick(landmarks, LM.LEFT_SHOULDER, 0.12);
    const rs = pick(landmarks, LM.RIGHT_SHOULDER, 0.12);
    if (!lk || !rk) return this.ready("Step back — show both knees");

    const scale =
      ls && rs
        ? Math.max(distance(ls, rs), Math.abs(lk.y - rk.y), 1e-3)
        : Math.max(Math.abs(lk.y - rk.y), Math.abs(lk.x - rk.x), 1e-3);

    const kneeSpread = Math.abs(lk.y - rk.y) / scale;
    const thighs = bothThighAngles(landmarks);
    const thighDiff = thighs ? Math.abs(thighs.left - thighs.right) : 0;

    const atDepth = kneeSpread > 0.12 || thighDiff > 18;
    const atStand = kneeSpread < 0.05 && thighDiff < 12;

    if (atDepth) {
      this.peakFrames += 1;
      if (this.peakFrames >= 2) return this.active();
      return this.ready("Step into a lunge!");
    }

    this.peakFrames = 0;

    if (this.phase === "active") {
      if (atStand) {
        this.returnFrames += 1;
        if (this.returnFrames >= 2) {
          this.recordRep("+1 Lunge!");
          return this.moveStatus;
        }
      } else {
        this.returnFrames = 0;
      }
      return this.active();
    }

    return this.ready("Step into a lunge!");
  }
}
