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
  | "Stand in the frame"
  | "Show your shoulders"
  | "Show both arms"
  | "Step back — show your hips"
  | "Step back from the camera"
  | "Raise your arms"
  | "Lower your arms"
  | "+1 Jumping jack!"
  | "Squat down"
  | "Stand up"
  | "+1 Squat!"
  | "Left stretch — reach up"
  | "Left stretch ✓ — pulse again"
  | "Left stretch — pulse again"
  | "Left done ✓ — switch to right"
  | "Right stretch — reach up"
  | "Right stretch ✓ — pulse again"
  | "Right stretch — pulse again"
  | "Use your left arm"
  | "Use your right arm"
  | "+1 Arm stretch!"
  | "Need more light";

export const READY_HINT: Record<ExerciseId, PoseDetectionHint> = {
  jumping_jacks: "Raise your arms",
  squats: "Squat down",
  arm_stretching: "Left stretch — reach up",
};

export const GO_HINT: Record<ExerciseId, PoseDetectionHint> = {
  jumping_jacks: "Lower your arms",
  squats: "Stand up",
  arm_stretching: "Left stretch ✓ — pulse again",
};

export function hasExercisePoseBody(landmarks: PoseLandmark[], exerciseId?: ExerciseId): boolean {
  return evaluateLegGate(landmarks, exerciseId ?? "squats").ok;
}

export function needsLegsInFrame(exerciseId?: ExerciseId): boolean {
  return exerciseId === "squats";
}

export class PoseExerciseRepDetector {
  private phase: "ready" | "active" = "ready";
  private lastRepAt = 0;
  private moveStatus: MoveStatus = "Stopped";
  private hint: PoseDetectionHint = null;
  private gateFailStreak = 0;
  private peakFrames = 0;
  private returnFrames = 0;

  /** Standing scale samples (jacks / stretches). */
  private standTorso = 0;
  private standSamples = 0;
  /** Jumping-jack openness + peak; must fully rest between reps. */
  private jackOpenEma = 0;
  private jackPeakOpen = 0;
  private jackNeedRest = false;

  /** Squat hysteresis: standing ↔ bottom (no long time-lock — that felt laggy). */
  private hipEma = 0;
  private standHipY = 0;
  private bottomHipY = 0;
  private standLocked = false;
  private squatDown = false;
  /** +1 hips-down-in-frame, -1 if device Y is inverted. */
  private squatSign = 1;

  /** Arm stretch: left pulse ×2 → right pulse ×2. Count at each reach peak. */
  private stretchStep = 0;
  private stretchWristEma = 0;
  private stretchPeakY = 0;
  private stretchValleyY = 0;
  private stretchHoldFrames = 0;
  /** after_count → need tiny ease; after_ease → need rise for next count; ready → can score */
  private stretchPhase: "ready" | "after_count" | "after_ease" = "ready";
  private stretchTrackSide: "left" | "right" | null = null;

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
    this.jackOpenEma = 0;
    this.jackPeakOpen = 0;
    this.jackNeedRest = false;
    this.hipEma = 0;
    this.standHipY = 0;
    this.bottomHipY = 0;
    this.standLocked = false;
    this.squatDown = false;
    this.squatSign = 1;
    this.resetStretchCycle(true);
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
      case "arm_stretching":
        return this.armStretching(landmarks);
    }
  }

  private resetSoft(hint: PoseDetectionHint) {
    this.phase = "ready";
    this.peakFrames = 0;
    this.returnFrames = 0;
    this.standTorso = 0;
    this.standSamples = 0;
    this.jackOpenEma = 0;
    this.jackPeakOpen = 0;
    this.jackNeedRest = false;
    this.hipEma = 0;
    this.standHipY = 0;
    this.bottomHipY = 0;
    this.standLocked = false;
    this.squatDown = false;
    this.squatSign = 1;
    // Keep stretchStep — brief gate loss shouldn't wipe a half-finished rep.
    this.stretchWristEma = 0;
    this.stretchPeakY = 0;
    this.stretchValleyY = 0;
    this.stretchHoldFrames = 0;
    this.stretchPhase = "ready";
    this.stretchTrackSide = null;
    this.moveStatus = "Watching";
    this.hint = hint || "Stand in the frame";
  }

  private resetStretchCycle(full: boolean) {
    if (full) this.stretchStep = 0;
    this.stretchWristEma = 0;
    this.stretchPeakY = 0;
    this.stretchValleyY = 0;
    this.stretchHoldFrames = 0;
    this.stretchPhase = "ready";
    this.stretchTrackSide = null;
  }

  /** Order: left, left, right, right. */
  private stretchNeededSide(): "left" | "right" {
    return this.stretchStep < 2 ? "left" : "right";
  }

  private stretchReadyHint(): PoseDetectionHint {
    switch (this.stretchStep) {
      case 0:
        return "Left stretch — reach up";
      case 1:
        return "Left stretch — pulse again";
      case 2:
        return "Right stretch — reach up";
      default:
        return "Right stretch — pulse again";
    }
  }

  private stretchPulseHint(): PoseDetectionHint {
    switch (this.stretchStep) {
      case 1:
        return "Left stretch ✓ — pulse again";
      case 2:
        return "Left done ✓ — switch to right";
      case 3:
        return "Right stretch ✓ — pulse again";
      default:
        return this.stretchReadyHint();
    }
  }

  private recordPulse(): MoveStatus {
    this.stretchStep += 1;
    this.stretchPeakY = this.stretchWristEma;
    this.stretchHoldFrames = 0;
    this.stretchPhase = "after_count";

    if (this.stretchStep >= 4) {
      this.resetStretchCycle(true);
      this.recordRep("+1 Arm stretch!");
      return this.moveStatus;
    }

    this.phase = "active";
    this.moveStatus = "Move!";
    this.hint = this.stretchPulseHint();
    return this.moveStatus;
  }

  private readyWithStretchHint(): MoveStatus {
    return this.ready(this.stretchReadyHint());
  }

  private activeWithPulseHint(): MoveStatus {
    this.phase = "active";
    this.moveStatus = "Move!";
    this.hint = this.stretchPulseHint();
    return this.moveStatus;
  }

  private recordRep(hint: PoseDetectionHint, cooldownMs = REP_COOLDOWN_MS) {
    const now = Date.now();
    if (now - this.lastRepAt < cooldownMs) return false;
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

  /**
   * Jumping jack: arms up/out (green) → arms back down (+1).
   * Requires a real open, then a clear close, then rest before the next rep
   * (stops near-camera noise from spamming +1).
   */
  private jacks(landmarks: PoseLandmark[]): MoveStatus {
    const ls = pick(landmarks, LM.LEFT_SHOULDER, 0.08);
    const rs = pick(landmarks, LM.RIGHT_SHOULDER, 0.08);
    if (!ls || !rs) return this.ready("Show your shoulders");

    const le = pick(landmarks, LM.LEFT_ELBOW, 0.04);
    const re = pick(landmarks, LM.RIGHT_ELBOW, 0.04);
    const lw = pick(landmarks, LM.LEFT_WRIST, 0.04) ?? le;
    const rw = pick(landmarks, LM.RIGHT_WRIST, 0.04) ?? re;
    if (!lw || !rw) return this.ready("Show both arms");

    const shoulderY = avg(ls.y, rs.y);
    const shoulderW = Math.max(distance(ls, rs), 1e-3);

    // Too close → shoulder span fills the frame and ratios go wild
    if (landmarksUseNormalizedCoords(landmarks) && shoulderW > 0.38) {
      this.phase = "ready";
      this.jackPeakOpen = 0;
      this.jackNeedRest = true;
      return this.ready("Step back from the camera");
    }

    const leftY = Math.min(lw.y, le?.y ?? lw.y);
    const rightY = Math.min(rw.y, re?.y ?? rw.y);
    const spread = distance(lw, rw);

    const leftUp = (shoulderY - leftY) / shoulderW;
    const rightUp = (shoulderY - rightY) / shoulderW;
    // Both arms must contribute (stops one-arm / jitter opens)
    const bothUp = Math.min(leftUp, rightUp);
    const avgUp = (leftUp + rightUp) * 0.5;
    const heightScore = Math.max(0, Math.min(1, avgUp / 0.18));
    const bothUpOk = bothUp > 0.06;
    const widthScore = Math.max(0, Math.min(1, (spread / shoulderW - 1.05) / 0.55));
    const open = bothUpOk ? Math.max(heightScore, widthScore * 0.75) : heightScore * 0.5;

    this.jackOpenEma = open;

    // After a rep: arms must come down before another open counts
    if (this.jackNeedRest) {
      if (open <= 0.14 && bothUp < 0.04) {
        this.jackNeedRest = false;
        this.jackPeakOpen = 0;
        this.phase = "ready";
      } else {
        this.phase = "ready";
        this.moveStatus = "Watching";
        this.hint = "Lower your arms";
        return this.moveStatus;
      }
    }

    if (this.phase !== "active") {
      // Need a clear open — both arms up and/or clearly wide
      if (open >= 0.35 && bothUpOk) {
        this.jackPeakOpen = open;
        this.peakFrames = 1;
        return this.active();
      }
      this.jackPeakOpen = 0;
      return this.ready("Raise your arms");
    }

    if (open > this.jackPeakOpen) this.jackPeakOpen = open;

    // Clear close: dropped a lot from peak AND fairly down, or fully down
    const dropped = this.jackPeakOpen - open >= 0.2;
    const downEnough = open <= 0.18;
    const fullyDown = open <= 0.12 && bothUp < 0.03;

    if ((dropped && downEnough) || fullyDown) {
      this.jackPeakOpen = 0;
      this.peakFrames = 0;
      this.jackNeedRest = true;
      this.jackOpenEma = Math.min(open, 0.1);
      this.recordRep("+1 Jumping jack!", 350);
      return this.moveStatus;
    }

    return this.active();
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
      if (this.standSamples < 5) return this.ready("Squat down");
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
      return this.ready("Squat down");
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

  /**
   * Left ×2 then right ×2.
   *
   * #1 counts as soon as the arm is overhead (no arms-down needed).
   * Then a tiny bob (still overhead) re-arms, and reaching up again = #2.
   */
  private armStretching(landmarks: PoseLandmark[]): MoveStatus {
    const ls = pick(landmarks, LM.LEFT_SHOULDER, 0.1);
    const rs = pick(landmarks, LM.RIGHT_SHOULDER, 0.1);
    const le = pick(landmarks, LM.LEFT_ELBOW, 0.08);
    const re = pick(landmarks, LM.RIGHT_ELBOW, 0.08);
    const lw = pick(landmarks, LM.LEFT_WRIST, 0.08) ?? le;
    const rw = pick(landmarks, LM.RIGHT_WRIST, 0.08) ?? re;
    if (!ls || !rs) return this.ready("Show your shoulders");
    if (!lw || !rw) return this.ready("Show both arms");

    const needed = this.stretchNeededSide();
    const leftTipY = Math.min(lw.y, le?.y ?? lw.y);
    const rightTipY = Math.min(rw.y, re?.y ?? rw.y);
    const tipY = needed === "left" ? leftTipY : rightTipY;
    const otherTipY = needed === "left" ? rightTipY : leftTipY;

    if (this.stretchTrackSide !== needed) {
      this.stretchTrackSide = needed;
      this.stretchWristEma = tipY;
      this.stretchPeakY = 0;
      this.stretchValleyY = 0;
      this.stretchHoldFrames = 0;
      this.stretchPhase = "ready";
    }

    const shoulderY = avg(ls.y, rs.y);
    const shoulderW = Math.max(distance(ls, rs), 1e-3);
    this.stretchWristEma = 0.35 * this.stretchWristEma + 0.65 * tipY;

    const norm = landmarksUseNormalizedCoords(landmarks);
    const bob = norm ? 0.012 : Math.max(shoulderW * 0.03, 8);
    const overhead = this.stretchWristEma < shoulderY - (norm ? 0.03 : shoulderW * 0.04);

    const otherOverhead =
      otherTipY < shoulderY - (norm ? 0.03 : shoulderW * 0.04) &&
      otherTipY < this.stretchWristEma - (norm ? 0.02 : shoulderW * 0.04);
    if (otherOverhead && !overhead && this.stretchPhase === "ready") {
      return this.ready(needed === "left" ? "Use your left arm" : "Use your right arm");
    }

    // Just scored: need a tiny ease from the peak (can stay well above shoulders)
    if (this.stretchPhase === "after_count") {
      if (this.stretchWristEma > this.stretchPeakY + bob) {
        this.stretchValleyY = this.stretchWristEma;
        this.stretchPhase = "after_ease";
        this.stretchHoldFrames = 0;
      }
      return this.activeWithPulseHint();
    }

    // Eased a little: reach up again from that valley
    if (this.stretchPhase === "after_ease") {
      if (this.stretchWristEma < this.stretchValleyY - bob) {
        this.stretchPhase = "ready";
        this.stretchHoldFrames = 0;
      } else {
        return this.readyWithStretchHint();
      }
    }

    // ready: count as soon as arm is held overhead
    if (overhead) {
      this.stretchHoldFrames += 1;
      if (this.stretchHoldFrames >= 2) {
        return this.recordPulse();
      }
      this.phase = "active";
      this.moveStatus = "Move!";
      this.hint = this.stretchReadyHint();
      return this.moveStatus;
    }

    this.stretchHoldFrames = 0;
    return this.readyWithStretchHint();
  }
}
