/**
 * Half-body-friendly rep counters for LearnGate (front camera).
 *
 * - Jacks: arm open/close (wrists) — feet not required
 * - Squats: hip drop + thigh bend — ankles not required
 * - Lunges: knee asymmetry — ankles not required
 */
import type { ExerciseId } from "@/data/exercises";
import type { PoseLandmark } from "@mefitzgerald/expo-pose-detection";
import type { MoveStatus } from "@/services/exerciseRepDetection";
import {
  LM,
  avg,
  bothKneeAngles,
  bothThighAngles,
  distance,
  evaluateLegGate,
  hipMidY,
  kneeMidY,
  pick,
  shoulderMidY,
} from "@/services/exercisePoseLegGate";

const REP_COOLDOWN_MS = 550;

export type PoseDetectionHint =
  | null
  | "Stand inside the frame"
  | "Show your shoulders in the border"
  | "Show both arms / hands"
  | "Step back a bit — show your hips"
  | "Step back — show at least one knee"
  | "Step back — show both knees for lunges"
  | "Open arms up and out"
  | "Good! Now bring arms down"
  | "Jumping jack counted!"
  | "Bend down into a squat"
  | "Good! Now stand up"
  | "Squat counted!"
  | "Step into a lunge"
  | "Lunge counted!"
  | "Turn on more lights";

export function hasExercisePoseBody(landmarks: PoseLandmark[], exerciseId?: ExerciseId): boolean {
  return evaluateLegGate(landmarks, exerciseId ?? "squats").ok;
}

export function needsLegsInFrame(exerciseId?: ExerciseId): boolean {
  return exerciseId === "squats" || exerciseId === "lunges";
}

export class PoseExerciseRepDetector {
  private repState: "ready" | "open" | "closed" | "down" | "up" = "ready";
  private lastRepAt = 0;
  private moveStatus: MoveStatus = "Stopped";
  private hint: PoseDetectionHint = null;
  private baselineHipY = 0;
  private baselineTorso = 1;
  private calibrated = false;
  private gateOkFrames = 0;

  constructor(
    private exerciseId: ExerciseId,
    private readonly onRep: () => void,
  ) {}

  reset() {
    this.repState = "ready";
    this.lastRepAt = 0;
    this.moveStatus = "Stopped";
    this.hint = null;
    this.baselineHipY = 0;
    this.baselineTorso = 1;
    this.calibrated = false;
    this.gateOkFrames = 0;
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

  feed(landmarks: PoseLandmark[], _frameWidth = 720, _frameHeight = 1280): MoveStatus {
    const gate = evaluateLegGate(landmarks, this.exerciseId);
    if (!gate.ok) {
      this.gateOkFrames = 0;
      this.calibrated = false;
      this.moveStatus = "Watching";
      this.hint = (gate.message as PoseDetectionHint) || "Stand inside the frame";
      return this.moveStatus;
    }

    this.gateOkFrames += 1;
    if (!this.calibrated && this.gateOkFrames >= 4) {
      this.calibrate(landmarks);
      this.calibrated = true;
    }

    switch (this.exerciseId) {
      case "jumping_jacks":
        return this.processJumpingJack(landmarks);
      case "squats":
        return this.processSquat(landmarks);
      case "lunges":
        return this.processLunge(landmarks);
    }
  }

  private calibrate(landmarks: PoseLandmark[]) {
    const hip = hipMidY(landmarks);
    const shoulder = shoulderMidY(landmarks);
    if (hip == null || shoulder == null) return;
    this.baselineHipY = hip;
    this.baselineTorso = Math.max(Math.abs(hip - shoulder), 1e-3);
  }

  private recordRep(hint: PoseDetectionHint) {
    const now = Date.now();
    if (now - this.lastRepAt < REP_COOLDOWN_MS) return;
    this.lastRepAt = now;
    this.onRep();
    this.moveStatus = "Rep!";
    this.hint = hint;
  }

  /** Arms-focused jumping jack — looser open/close so real jacks count. */
  private processJumpingJack(landmarks: PoseLandmark[]): MoveStatus {
    const ls = pick(landmarks, LM.LEFT_SHOULDER);
    const rs = pick(landmarks, LM.RIGHT_SHOULDER);
    const lw = pick(landmarks, LM.LEFT_WRIST) ?? pick(landmarks, LM.LEFT_ELBOW);
    const rw = pick(landmarks, LM.RIGHT_WRIST) ?? pick(landmarks, LM.RIGHT_ELBOW);
    if (!ls || !rs || !lw || !rw) {
      this.moveStatus = "Watching";
      this.hint = "Show both arms / hands";
      return this.moveStatus;
    }

    const shoulderY = avg(ls.y, rs.y);
    const shoulderW = Math.max(distance(ls, rs), 1e-3);
    const wristY = avg(lw.y, rw.y);
    const wristSpread = distance(lw, rw);

    // Peak: arms clearly above shoulders OR clearly wider than shoulders
    const armsUp = wristY < shoulderY - shoulderW * 0.02;
    const armsWide = wristSpread > shoulderW * 1.2;
    const atPeak = armsUp || armsWide;

    // Return: arms no longer at peak, and either coming down or closing in
    const armsComingDown = wristY > shoulderY - shoulderW * 0.12;
    const armsClosing = wristSpread < shoulderW * 1.32;
    const atRest = !atPeak && armsComingDown && armsClosing;

    if (atPeak) {
      this.repState = "open";
      this.moveStatus = "Move!";
      this.hint = "Good! Now bring arms down";
      return this.moveStatus;
    }

    if (this.repState === "open" && atRest) {
      this.repState = "closed";
      this.recordRep("Jumping jack counted!");
      return this.moveStatus;
    }

    // Stay in "waiting to close" while transitioning down from open
    if (this.repState === "open") {
      this.moveStatus = "Move!";
      this.hint = "Good! Now bring arms down";
      return this.moveStatus;
    }

    this.moveStatus = "Watching";
    this.hint = "Open arms up and out";
    return this.moveStatus;
  }

  /** Hip-drop + thigh bend squat (works without feet). */
  private processSquat(landmarks: PoseLandmark[]): MoveStatus {
    const hip = hipMidY(landmarks);
    if (hip == null) {
      this.moveStatus = "Watching";
      this.hint = "Step back a bit — show your hips";
      return this.moveStatus;
    }

    const hipDrop =
      this.calibrated && this.baselineTorso > 0
        ? (hip - this.baselineHipY) / this.baselineTorso
        : 0;

    const ankles = bothKneeAngles(landmarks);
    const thighs = bothThighAngles(landmarks);

    let bentScore = 0; // higher = more squat-like
    if (ankles) {
      const knee = avg(ankles.left, ankles.right);
      // panelists: deep < 125, stand > 155 → map to score
      bentScore = Math.max(bentScore, (160 - knee) / 40);
    }
    if (thighs) {
      const thigh = avg(thighs.left, thighs.right);
      // standing thigh ~165–180, squat often ~100–140
      bentScore = Math.max(bentScore, (165 - thigh) / 45);
    }
    bentScore = Math.max(bentScore, hipDrop / 0.12);

    const atDepth = bentScore >= 0.55 || hipDrop > 0.07;
    const atRest = bentScore < 0.25 && hipDrop < 0.03;

    if (atDepth) {
      this.repState = "down";
      this.moveStatus = "Move!";
      this.hint = "Good! Now stand up";
      return this.moveStatus;
    }

    if (this.repState === "down" && atRest) {
      this.repState = "up";
      this.recordRep("Squat counted!");
      return this.moveStatus;
    }

    this.moveStatus = "Watching";
    this.hint = "Bend down into a squat";
    return this.moveStatus;
  }

  /** Front-camera lunge via knee height / angle asymmetry. */
  private processLunge(landmarks: PoseLandmark[]): MoveStatus {
    const lk = pick(landmarks, LM.LEFT_KNEE);
    const rk = pick(landmarks, LM.RIGHT_KNEE);
    const hip = hipMidY(landmarks);
    const kneeY = kneeMidY(landmarks);
    if (!lk || !rk || hip == null) {
      this.moveStatus = "Watching";
      this.hint = "Step back — show both knees for lunges";
      return this.moveStatus;
    }

    const ankles = bothKneeAngles(landmarks);
    const thighs = bothThighAngles(landmarks);
    const kneeSpread = Math.abs(lk.y - rk.y);
    const scale = this.baselineTorso > 0 ? this.baselineTorso : Math.max(Math.abs(lk.y - hip), 1e-3);
    const spreadRatio = kneeSpread / scale;

    let deepDiff = 0;
    if (ankles) deepDiff = Math.abs(ankles.left - ankles.right);
    else if (thighs) deepDiff = Math.abs(thighs.left - thighs.right);

    const lowered = kneeY != null ? hip > kneeY - scale * 0.35 : true;
    const atDepth = (spreadRatio > 0.08 || deepDiff > 18) && lowered;
    const atRest = spreadRatio < 0.04 && deepDiff < 12;

    if (atDepth) {
      this.repState = "down";
      this.moveStatus = "Move!";
      this.hint = "Good! Now stand up";
      return this.moveStatus;
    }

    if (this.repState === "down" && atRest) {
      this.repState = "up";
      this.recordRep("Lunge counted!");
      return this.moveStatus;
    }

    this.moveStatus = "Watching";
    this.hint = "Step into a lunge";
    return this.moveStatus;
  }
}
