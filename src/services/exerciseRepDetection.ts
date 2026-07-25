import type { ExerciseId } from "@/data/exercises";

export type MoveStatus = "Stopped" | "Watching" | "Move!" | "Rep!";

type DetectorConfig = {
  motionThreshold: number;
  calmThreshold: number;
  cooldownMs: number;
  minActiveMs: number;
};

function configFor(exerciseId: ExerciseId): DetectorConfig {
  switch (exerciseId) {
    case "jumping_jacks":
      return { motionThreshold: 7, calmThreshold: 4, cooldownMs: 900, minActiveMs: 180 };
    case "squats":
      return { motionThreshold: 9, calmThreshold: 5, cooldownMs: 1300, minActiveMs: 280 };
    case "arm_stretching":
      return { motionThreshold: 8, calmThreshold: 4, cooldownMs: 1600, minActiveMs: 300 };
  }
}

/** Compare two JPEG base64 frames; higher value means more scene change (body movement). */
export function frameMotionScore(previous: string, current: string): number {
  const len = Math.min(previous.length, current.length);
  if (len < 64) return 0;
  const step = Math.max(1, Math.floor(len / 220));
  let diff = 0;
  let n = 0;
  for (let i = 0; i < len; i += step) {
    diff += Math.abs(previous.charCodeAt(i) - current.charCodeAt(i));
    n += 1;
  }
  return diff / Math.max(1, n);
}

/**
 * Counts one rep when the child moves (active phase) then returns to a calmer pose.
 * Uses consecutive camera snapshots — no manual tap.
 */
export class ExerciseRepDetector {
  private phase: "idle" | "active" = "idle";
  private lastFrame: string | null = null;
  private lastRepAt = 0;
  private activeSince = 0;
  private peakDiff = 0;
  private moveStatus: MoveStatus = "Stopped";

  constructor(
    private exerciseId: ExerciseId,
    private readonly onRep: () => void,
  ) {}

  reset() {
    this.phase = "idle";
    this.lastFrame = null;
    this.lastRepAt = 0;
    this.peakDiff = 0;
    this.moveStatus = "Stopped";
  }

  setExerciseId(exerciseId: ExerciseId) {
    this.exerciseId = exerciseId;
    this.reset();
  }

  getStatus(): MoveStatus {
    return this.moveStatus;
  }

  feedFrame(base64: string): MoveStatus {
    if (!this.lastFrame) {
      this.lastFrame = base64;
      this.moveStatus = "Watching";
      return this.moveStatus;
    }

    const diff = frameMotionScore(this.lastFrame, base64);
    this.lastFrame = base64;
    const cfg = configFor(this.exerciseId);
    const now = Date.now();

    if (this.phase === "idle") {
      if (diff > cfg.motionThreshold) {
        this.phase = "active";
        this.activeSince = now;
        this.peakDiff = diff;
        this.moveStatus = "Move!";
      } else {
        this.moveStatus = "Watching";
      }
      return this.moveStatus;
    }

    this.peakDiff = Math.max(this.peakDiff, diff);
    if (diff < cfg.calmThreshold && now - this.activeSince >= cfg.minActiveMs) {
      if (this.peakDiff >= cfg.motionThreshold && now - this.lastRepAt >= cfg.cooldownMs) {
        this.lastRepAt = now;
        this.onRep();
        this.moveStatus = "Rep!";
      } else {
        this.moveStatus = "Watching";
      }
      this.phase = "idle";
      this.peakDiff = 0;
      return this.moveStatus;
    }

    this.moveStatus = "Move!";
    return this.moveStatus;
  }
}
