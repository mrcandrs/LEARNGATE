import type { ExerciseId } from "@/data/exercises";
import type { PoseLandmark } from "@mefitzgerald/expo-pose-detection";
import type { MoveStatus } from "@/services/exerciseRepDetection";
import {
  evaluateLegGate,
  hipDropRatio,
  kneeFlexionAngles,
  legExtensionRatios,
  snapshotTorso,
  thighBendProxies,
} from "@/services/exercisePoseLegGate";

const MIN_LIKELIHOOD = 0.25;
const REP_COOLDOWN_MS = 1000;
const DEPTH_HOLD_FRAMES = 3;
const REST_HOLD_FRAMES = 2;
const READY_FRAMES = 5;
const LEG_STABLE_FRAMES = 5;
const LEG_FAIL_RESET = 10;

const LM = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
} as const;

export type PoseDetectionHint =
  | null
  | "Stand inside the frame"
  | "Step back — show your legs"
  | "Step back — both knees must be on screen"
  | "Hold still — calibrating…"
  | "Turn on more lights"
  | "Lower into squat"
  | "Push back up"
  | "Step into lunge"
  | "Push back to standing"
  | "Jump — arms up and out"
  | "Return to start position";

class MetricEma {
  private value: number | null = null;

  constructor(private readonly alpha = 0.4) {}

  reset() {
    this.value = null;
  }

  push(sample: number): number {
    this.value =
      this.value == null ? sample : this.alpha * sample + (1 - this.alpha) * this.value;
    return this.value;
  }
}

function landmark(landmarks: PoseLandmark[], type: number): PoseLandmark | null {
  const lm = landmarks.find((l) => l.type === type);
  if (!lm || lm.inFrameLikelihood < MIN_LIKELIHOOD) return null;
  return lm;
}

export function hasExercisePoseBody(landmarks: PoseLandmark[], exerciseId?: ExerciseId): boolean {
  const ls = landmark(landmarks, LM.LEFT_SHOULDER);
  const rs = landmark(landmarks, LM.RIGHT_SHOULDER);
  const le = landmark(landmarks, LM.LEFT_ELBOW);
  const re = landmark(landmarks, LM.RIGHT_ELBOW);
  const lw = landmark(landmarks, LM.LEFT_WRIST);
  const rw = landmark(landmarks, LM.RIGHT_WRIST);
  const lh = landmark(landmarks, 23);
  const rh = landmark(landmarks, 24);
  const lk = landmark(landmarks, LM.LEFT_KNEE);
  const rk = landmark(landmarks, LM.RIGHT_KNEE);

  if (exerciseId === "jumping_jacks") {
    return Boolean((ls || rs) && (lw || rw || le || re));
  }

  return Boolean((ls || rs) && (lh || rh || lk || rk));
}

export function needsLegsInFrame(exerciseId?: ExerciseId): boolean {
  return exerciseId === "squats" || exerciseId === "lunges";
}

export class PoseExerciseRepDetector {
  private phase: "rest" | "peak" = "rest";
  private lastRepAt = 0;
  private moveStatus: MoveStatus = "Stopped";
  private hint: PoseDetectionHint = null;
  private readyFrames = 0;
  private legStableFrames = 0;
  private legFailStreak = 0;
  private repArmed = false;
  private depthFrames = 0;
  private restFrames = 0;
  private depthAchieved = false;
  private baselineHipY = 0;
  private baselineKneeY = 0;
  private baselineLeftLeg = 0;
  private baselineRightLeg = 0;
  private baselineKneeSpreadY = 0;
  private torsoLen = 0.1;
  private readonly hipDropEma = new MetricEma();
  private readonly kneeBendEma = new MetricEma();
  private readonly lungeSpreadEma = new MetricEma();

  constructor(
    private exerciseId: ExerciseId,
    private readonly onRep: () => void,
  ) {}

  reset() {
    this.phase = "rest";
    this.lastRepAt = 0;
    this.moveStatus = "Stopped";
    this.hint = null;
    this.readyFrames = 0;
    this.legStableFrames = 0;
    this.legFailStreak = 0;
    this.repArmed = false;
    this.depthFrames = 0;
    this.restFrames = 0;
    this.depthAchieved = false;
    this.baselineHipY = 0;
    this.baselineKneeY = 0;
    this.baselineLeftLeg = 0;
    this.baselineRightLeg = 0;
    this.baselineKneeSpreadY = 0;
    this.torsoLen = 0.1;
    this.hipDropEma.reset();
    this.kneeBendEma.reset();
    this.lungeSpreadEma.reset();
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

  feed(landmarks: PoseLandmark[], frameWidth = 720, frameHeight = 1280): MoveStatus {
    if (needsLegsInFrame(this.exerciseId)) {
      const gate = evaluateLegGate(landmarks, this.exerciseId, frameWidth, frameHeight);
      if (!gate.ok) {
        this.legFailStreak += 1;
        if (this.legFailStreak >= LEG_FAIL_RESET) {
          this.resetCalibration();
        }
        this.moveStatus = "Watching";
        this.hint = gate.message as PoseDetectionHint;
        return this.moveStatus;
      }
      this.legFailStreak = 0;
      this.legStableFrames += 1;
      if (this.legStableFrames < LEG_STABLE_FRAMES) {
        this.moveStatus = "Watching";
        this.hint = "Hold still — calibrating…";
        return this.moveStatus;
      }
    } else if (!hasExercisePoseBody(landmarks, this.exerciseId)) {
      this.resetCalibration();
      this.moveStatus = "Watching";
      this.hint = "Stand inside the frame";
      return this.moveStatus;
    }

    this.readyFrames += 1;
    if (!this.repArmed) {
      if (this.readyFrames < READY_FRAMES) {
        this.moveStatus = "Watching";
        this.hint = "Hold still — calibrating…";
        return this.moveStatus;
      }
      this.repArmed = true;
      this.calibrate(landmarks);
    }

    switch (this.exerciseId) {
      case "jumping_jacks":
        return this.feedJumpingJack(landmarks);
      case "squats":
        return this.feedSquat(landmarks);
      case "lunges":
        return this.feedLunge(landmarks);
    }
  }

  private resetCalibration() {
    this.readyFrames = 0;
    this.legStableFrames = 0;
    this.repArmed = false;
    this.phase = "rest";
    this.depthFrames = 0;
    this.restFrames = 0;
    this.depthAchieved = false;
    this.hipDropEma.reset();
    this.kneeBendEma.reset();
    this.lungeSpreadEma.reset();
  }

  private calibrate(landmarks: PoseLandmark[]) {
    const torso = snapshotTorso(landmarks);
    if (torso) {
      this.baselineHipY = torso.hipY;
      this.baselineKneeY = torso.kneeY ?? torso.hipY;
      this.torsoLen = torso.torsoLen;
    }

    const legs = legExtensionRatios(landmarks, this.torsoLen);
    if (legs) {
      this.baselineLeftLeg = legs.left;
      this.baselineRightLeg = legs.right;
    }

    const lk = landmark(landmarks, LM.LEFT_KNEE);
    const rk = landmark(landmarks, LM.RIGHT_KNEE);
    if (lk && rk) {
      this.baselineKneeSpreadY = Math.abs(lk.y - rk.y);
    }
  }

  private bestKneeBend(landmarks: PoseLandmark[]): number | null {
    const flexion = kneeFlexionAngles(landmarks);
    const proxies = thighBendProxies(landmarks);
    const all = [...flexion, ...proxies];
    if (!all.length) return null;
    return Math.min(...all);
  }

  private feedSquat(landmarks: PoseLandmark[]): MoveStatus {
    const dropRaw = hipDropRatio(landmarks, this.baselineHipY, this.torsoLen);
    const bendRaw = this.bestKneeBend(landmarks);
    const now = Date.now();

    const drop = dropRaw != null ? this.hipDropEma.push(dropRaw) : null;
    const bend = bendRaw != null ? this.kneeBendEma.push(bendRaw) : null;

    let atDepth = false;
    let atRest = false;

    if (drop != null && bend != null) {
      atDepth = drop > 0.065 || bend >= 38;
      atRest = drop < 0.028 && bend < 18;
    } else if (drop != null) {
      atDepth = drop > 0.075;
      atRest = drop < 0.028;
    } else if (bend != null) {
      atDepth = bend >= 42;
      atRest = bend < 16;
    }

    return this.cycleRep(atDepth, atRest, now, "Lower into squat", "Push back up");
  }

  private feedLunge(landmarks: PoseLandmark[]): MoveStatus {
    const legs = legExtensionRatios(landmarks, this.torsoLen);
    const lk = landmark(landmarks, LM.LEFT_KNEE);
    const rk = landmark(landmarks, LM.RIGHT_KNEE);
    if (!legs || !lk || !rk) {
      this.moveStatus = "Watching";
      this.hint = "Step back — both knees must be on screen";
      return this.moveStatus;
    }

    const spreadRaw = Math.abs(lk.y - rk.y) / this.torsoLen;
    const spread = this.lungeSpreadEma.push(spreadRaw);
    const leftDelta = legs.left - this.baselineLeftLeg;
    const rightDelta = legs.right - this.baselineRightLeg;
    const asymmetry = Math.abs(leftDelta - rightDelta);
    const bend = this.bestKneeBend(landmarks);
    const now = Date.now();

    let atDepth = false;
    let atRest = false;

    if (bend != null) {
      const flexion = kneeFlexionAngles(landmarks);
      const deep = flexion.length ? Math.min(...flexion) : bend;
      atDepth = (deep <= 112 && spread > 0.04) || asymmetry > 0.07;
      atRest = (deep >= 150 || bend < 20) && spread < 0.025 && asymmetry < 0.03;
    } else {
      atDepth = spread > 0.055 || asymmetry > 0.08;
      atRest = spread < 0.022 && asymmetry < 0.025;
    }

    return this.cycleRep(atDepth, atRest, now, "Step into lunge", "Push back to standing");
  }

  private feedJumpingJack(landmarks: PoseLandmark[]): MoveStatus {
    const ls = landmark(landmarks, LM.LEFT_SHOULDER);
    const rs = landmark(landmarks, LM.RIGHT_SHOULDER);
    const lw = landmark(landmarks, LM.LEFT_WRIST) ?? landmark(landmarks, LM.LEFT_ELBOW);
    const rw = landmark(landmarks, LM.RIGHT_WRIST) ?? landmark(landmarks, LM.RIGHT_ELBOW);
    if (!ls || !rs || !lw || !rw) {
      this.moveStatus = "Watching";
      this.hint = "Show your arms in the frame";
      return this.moveStatus;
    }

    const shoulderY = (ls.y + rs.y) / 2;
    const shoulderWidth = Math.max(Math.abs(rs.x - ls.x), 1e-4);
    const wristY = (lw.y + rw.y) / 2;
    const spread = Math.abs(rw.x - lw.x);
    const now = Date.now();

    const atPeak =
      wristY < shoulderY - shoulderWidth * 0.14 || spread > shoulderWidth * 1.3;
    const atRest =
      wristY > shoulderY - shoulderWidth * 0.05 && spread < shoulderWidth * 1.1;

    return this.cycleRep(atPeak, atRest, now, "Jump — arms up and out", "Return to start position");
  }

  private cycleRep(
    atDepth: boolean,
    atRest: boolean,
    now: number,
    peakHint: PoseDetectionHint,
    restHint: PoseDetectionHint,
  ): MoveStatus {
    if (atDepth && atRest) {
      this.moveStatus = "Watching";
      this.hint = peakHint;
      return this.moveStatus;
    }

    if (this.phase === "rest") {
      if (atDepth) {
        this.depthFrames += 1;
        this.restFrames = 0;
        if (this.depthFrames >= DEPTH_HOLD_FRAMES) {
          this.phase = "peak";
          this.depthAchieved = true;
          this.depthFrames = 0;
          this.moveStatus = "Move!";
          this.hint = restHint;
        } else {
          this.moveStatus = "Move!";
          this.hint = peakHint;
        }
      } else {
        this.depthFrames = 0;
        this.moveStatus = "Watching";
        this.hint = peakHint;
      }
      return this.moveStatus;
    }

    if (atRest && this.depthAchieved) {
      this.restFrames += 1;
      if (this.restFrames >= REST_HOLD_FRAMES && now - this.lastRepAt >= REP_COOLDOWN_MS) {
        this.lastRepAt = now;
        this.phase = "rest";
        this.depthFrames = 0;
        this.restFrames = 0;
        this.depthAchieved = false;
        this.onRep();
        this.moveStatus = "Rep!";
        this.hint = peakHint;
        return this.moveStatus;
      }
      this.moveStatus = "Move!";
      this.hint = restHint;
      return this.moveStatus;
    }

    this.restFrames = 0;
    if (atDepth) this.depthAchieved = true;
    this.moveStatus = "Move!";
    this.hint = restHint;
    return this.moveStatus;
  }
}
