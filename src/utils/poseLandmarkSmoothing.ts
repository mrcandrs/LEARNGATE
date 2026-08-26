import type { PoseLandmark } from "@mefitzgerald/expo-pose-detection";

type SmoothPoint = { x: number; y: number };

/**
 * Lightweight One Euro filter — cuts landmark jitter before rep detection
 * (and keeps any overlay drawing steadier on noisy cameras).
 */
export class PoseLandmarkSmoother {
  private readonly state = new Map<number, { point: SmoothPoint; dx: number; dy: number }>();
  private lastTime = 0;

  constructor(
    /** Higher = less lag (still filters phone jitter via beta). */
    private readonly minCutoff = 1.1,
    private readonly beta = 0.03,
    private readonly dCutoff = 1.0,
  ) {}

  reset() {
    this.state.clear();
    this.lastTime = 0;
  }

  smooth(landmarks: PoseLandmark[]): PoseLandmark[] {
    const now = Date.now();
    const dt = this.lastTime > 0 ? Math.max(0.001, (now - this.lastTime) / 1000) : 1 / 30;
    this.lastTime = now;

    return landmarks.map((lm) => {
      const prev = this.state.get(lm.type);
      if (!prev) {
        this.state.set(lm.type, { point: { x: lm.x, y: lm.y }, dx: 0, dy: 0 });
        return lm;
      }

      const dx = (lm.x - prev.point.x) / dt;
      const dy = (lm.y - prev.point.y) / dt;
      const edx = this.lowPass(dx, prev.dx, this.alpha(dt, this.dCutoff));
      const edy = this.lowPass(dy, prev.dy, this.alpha(dt, this.dCutoff));
      const speed = Math.hypot(edx, edy);
      const cutoff = this.minCutoff + this.beta * speed;
      const a = this.alpha(dt, cutoff);
      const x = this.lowPass(lm.x, prev.point.x, a);
      const y = this.lowPass(lm.y, prev.point.y, a);
      this.state.set(lm.type, { point: { x, y }, dx: edx, dy: edy });
      return { ...lm, x, y };
    });
  }

  private alpha(dt: number, cutoff: number): number {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  private lowPass(value: number, prev: number, alpha: number): number {
    return alpha * value + (1 - alpha) * prev;
  }
}
