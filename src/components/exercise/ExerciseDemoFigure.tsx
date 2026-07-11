import Svg, { Circle, Ellipse, G, Line, Path, Rect } from "react-native-svg";

const SKIN = "#FFE0B2";
const SHIRT = "#4CAF50";
const SHOE = "#1B3A2F";
const OUTLINE = "#1F2937";

const CX = 80;
const GROUND_Y = 176;

export type FigurePose = {
  footSpread: number;
  squatDepth: number;
  jackOpen: number;
  lungeStep: number;
  lungeBend: number;
  lungeLeadLeg: "left" | "right";
};

export const NEUTRAL_FIGURE_POSE: FigurePose = {
  footSpread: 0,
  squatDepth: 0,
  jackOpen: 0,
  lungeStep: 0,
  lungeBend: 0,
  lungeLeadLeg: "right",
};

export type GateyPoseValues = FigurePose;
export const NEUTRAL_GATEY_POSE = NEUTRAL_FIGURE_POSE;

type Props = {
  width: number;
  height: number;
  pose: FigurePose;
};

type Pt = { x: number; y: number };

type FrontSkeleton = {
  head: Pt;
  chest: Pt;
  pelvis: Pt;
  lShoulder: Pt;
  rShoulder: Pt;
  lElbow: Pt;
  rElbow: Pt;
  lHand: Pt;
  rHand: Pt;
  lHip: Pt;
  rHip: Pt;
  lKnee: Pt;
  rKnee: Pt;
  lFoot: Pt;
  rFoot: Pt;
};

const D2R = Math.PI / 180;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpPt(a: Pt, b: Pt, t: number): Pt {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

function polar(origin: Pt, length: number, angleFromDownDeg: number): Pt {
  const a = angleFromDownDeg * D2R;
  return { x: origin.x + Math.sin(a) * length, y: origin.y + Math.cos(a) * length };
}

function lerpSkeleton(a: FrontSkeleton, b: FrontSkeleton, t: number): FrontSkeleton {
  const k = (key: keyof FrontSkeleton) => lerpPt(a[key], b[key], t);
  return {
    head: k("head"),
    chest: k("chest"),
    pelvis: k("pelvis"),
    lShoulder: k("lShoulder"),
    rShoulder: k("rShoulder"),
    lElbow: k("lElbow"),
    rElbow: k("rElbow"),
    lHand: k("lHand"),
    rHand: k("rHand"),
    lHip: k("lHip"),
    rHip: k("rHip"),
    lKnee: k("lKnee"),
    rKnee: k("rKnee"),
    lFoot: k("lFoot"),
    rFoot: k("rFoot"),
  };
}

/**
 * Squat keyframes (front view) per NASM / Cleveland Clinic:
 * - Stand: shoulder-width feet, chest tall, arms at sides
 * - Bottom: hips back & down, knees over toes, thighs ~parallel, arms forward
 */
function squatKeyframes(wideStance: number): { stand: FrontSkeleton; bottom: FrontSkeleton } {
  const spread = lerp(20, 26, wideStance);
  const lFoot: Pt = { x: CX - spread, y: GROUND_Y };
  const rFoot: Pt = { x: CX + spread, y: GROUND_Y };

  const stand: FrontSkeleton = {
    pelvis: { x: CX, y: 108 },
    chest: { x: CX, y: 78 },
    head: { x: CX, y: 46 },
    lShoulder: { x: CX - 16, y: 80 },
    rShoulder: { x: CX + 16, y: 80 },
    lElbow: { x: CX - 22, y: 104 },
    rElbow: { x: CX + 22, y: 104 },
    lHand: { x: CX - 24, y: 126 },
    rHand: { x: CX + 24, y: 126 },
    lHip: { x: CX - 11, y: 108 },
    rHip: { x: CX + 11, y: 108 },
    lKnee: { x: CX - spread, y: 144 },
    rKnee: { x: CX + spread, y: 144 },
    lFoot,
    rFoot,
  };

  const bottom: FrontSkeleton = {
    pelvis: { x: CX - 2, y: 138 },
    chest: { x: CX + 2, y: 82 },
    head: { x: CX + 2, y: 50 },
    lShoulder: { x: CX - 16, y: 84 },
    rShoulder: { x: CX + 16, y: 84 },
    lElbow: { x: CX - 8, y: 100 },
    rElbow: { x: CX + 8, y: 100 },
    lHand: { x: CX - 6, y: 112 },
    rHand: { x: CX + 6, y: 112 },
    lHip: { x: CX - 13, y: 138 },
    rHip: { x: CX + 9, y: 138 },
    lKnee: { x: CX - spread + 12, y: 156 },
    rKnee: { x: CX + spread - 12, y: 156 },
    lFoot,
    rFoot,
  };

  return { stand, bottom };
}

function buildJackSkeleton(open: number): FrontSkeleton {
  const footX = lerp(10, 34, open);
  const armAngle = lerp(8, 135, open);
  const pelvis = { x: CX, y: 108 };
  const lShoulder = { x: CX - 16, y: 80 };
  const rShoulder = { x: CX + 16, y: 80 };
  const lElbow = polar(lShoulder, 24, -armAngle);
  const rElbow = polar(rShoulder, 24, armAngle);

  return {
    pelvis,
    chest: { x: CX, y: 78 },
    head: { x: CX, y: 46 },
    lShoulder,
    rShoulder,
    lElbow,
    rElbow,
    lHand: polar(lElbow, 22, -armAngle),
    rHand: polar(rElbow, 22, armAngle),
    lHip: { x: CX - 10, y: 108 },
    rHip: { x: CX + 10, y: 108 },
    lKnee: { x: CX - footX * 0.55, y: 142 },
    rKnee: { x: CX + footX * 0.55, y: 142 },
    lFoot: { x: CX - footX, y: GROUND_Y },
    rFoot: { x: CX + footX, y: GROUND_Y },
  };
}

function buildSquatSkeleton(depth: number, wideStance: number): FrontSkeleton {
  const { stand, bottom } = squatKeyframes(wideStance);
  if (depth <= 0.001) return stand;
  if (depth >= 0.999) return bottom;
  return lerpSkeleton(stand, bottom, depth);
}

function buildStandSkeleton(footSpread: number): FrontSkeleton {
  const spread = lerp(10, 22, footSpread);
  return {
    pelvis: { x: CX, y: 108 },
    chest: { x: CX, y: 78 },
    head: { x: CX, y: 46 },
    lShoulder: { x: CX - 16, y: 80 },
    rShoulder: { x: CX + 16, y: 80 },
    lElbow: { x: CX - 22, y: 104 },
    rElbow: { x: CX + 22, y: 104 },
    lHand: { x: CX - 24, y: 126 },
    rHand: { x: CX + 24, y: 126 },
    lHip: { x: CX - 10, y: 108 },
    rHip: { x: CX + 10, y: 108 },
    lKnee: { x: CX - spread, y: 144 },
    rKnee: { x: CX + spread, y: 144 },
    lFoot: { x: CX - spread, y: GROUND_Y },
    rFoot: { x: CX + spread, y: GROUND_Y },
  };
}

/** Side-profile lunge keyframes (ACE / Nike): stand → step → 90° front knee, back knee down. */
type ProfileLunge = {
  head: Pt;
  chest: Pt;
  pelvis: Pt;
  shoulder: Pt;
  elbow: Pt;
  hand: Pt;
  leadHip: Pt;
  trailHip: Pt;
  leadKnee: Pt;
  trailKnee: Pt;
  leadFoot: Pt;
  trailFoot: Pt;
};

function lerpProfile(a: ProfileLunge, b: ProfileLunge, t: number): ProfileLunge {
  const k = (key: keyof ProfileLunge) => lerpPt(a[key], b[key], t);
  return {
    head: k("head"),
    chest: k("chest"),
    pelvis: k("pelvis"),
    shoulder: k("shoulder"),
    elbow: k("elbow"),
    hand: k("hand"),
    leadHip: k("leadHip"),
    trailHip: k("trailHip"),
    leadKnee: k("leadKnee"),
    trailKnee: k("trailKnee"),
    leadFoot: k("leadFoot"),
    trailFoot: k("trailFoot"),
  };
}

const LUNGE_STAND: ProfileLunge = {
  pelvis: { x: 58, y: 108 },
  chest: { x: 64, y: 78 },
  head: { x: 66, y: 44 },
  shoulder: { x: 62, y: 80 },
  elbow: { x: 66, y: 102 },
  hand: { x: 68, y: 122 },
  leadHip: { x: 60, y: 108 },
  trailHip: { x: 56, y: 108 },
  leadKnee: { x: 58, y: 144 },
  trailKnee: { x: 56, y: 144 },
  leadFoot: { x: 58, y: GROUND_Y },
  trailFoot: { x: 56, y: GROUND_Y },
};

const LUNGE_STEPPED: ProfileLunge = {
  pelvis: { x: 68, y: 108 },
  chest: { x: 74, y: 78 },
  head: { x: 76, y: 44 },
  shoulder: { x: 72, y: 80 },
  elbow: { x: 76, y: 102 },
  hand: { x: 78, y: 122 },
  leadHip: { x: 70, y: 108 },
  trailHip: { x: 60, y: 108 },
  leadKnee: { x: 104, y: 142 },
  trailKnee: { x: 46, y: 142 },
  leadFoot: { x: 110, y: GROUND_Y },
  trailFoot: { x: 42, y: GROUND_Y },
};

const LUNGE_BOTTOM: ProfileLunge = {
  pelvis: { x: 70, y: 114 },
  chest: { x: 76, y: 82 },
  head: { x: 78, y: 48 },
  shoulder: { x: 74, y: 84 },
  elbow: { x: 78, y: 104 },
  hand: { x: 80, y: 122 },
  leadHip: { x: 72, y: 114 },
  trailHip: { x: 62, y: 114 },
  leadKnee: { x: 96, y: 134 },
  trailKnee: { x: 44, y: 166 },
  leadFoot: { x: 110, y: GROUND_Y },
  trailFoot: { x: 42, y: GROUND_Y },
};

function buildProfileLunge(step: number, bend: number): ProfileLunge {
  const afterStep = lerpProfile(LUNGE_STAND, LUNGE_STEPPED, step);
  return lerpProfile(afterStep, LUNGE_BOTTOM, bend);
}

function FrontFigure({ s }: { s: FrontSkeleton }) {
  return (
    <G>
      <Limb from={s.lHip} to={s.lKnee} width={10} />
      <Limb from={s.lKnee} to={s.lFoot} width={9} />
      <Rect
        x={s.chest.x - 18}
        y={s.chest.y - 6}
        width={36}
        height={s.pelvis.y - s.chest.y + 8}
        rx={10}
        fill={SHIRT}
        stroke={OUTLINE}
        strokeWidth={2}
      />
      <Limb from={s.rHip} to={s.rKnee} />
      <Limb from={s.rKnee} to={s.rFoot} />
      <Ellipse cx={s.lFoot.x} cy={s.lFoot.y + 2} rx={11} ry={4} fill={SHOE} />
      <Ellipse cx={s.rFoot.x} cy={s.rFoot.y + 2} rx={11} ry={4} fill={SHOE} />
      <Limb from={s.lShoulder} to={s.lElbow} />
      <Limb from={s.lElbow} to={s.lHand} width={8} />
      <Limb from={s.rShoulder} to={s.rElbow} />
      <Limb from={s.rElbow} to={s.rHand} width={8} />
      <Joint at={s.lKnee} r={5} />
      <Joint at={s.rKnee} r={5} />
      <Head at={s.head} />
    </G>
  );
}

function ProfileLungeFigure({ p, mirrored }: { p: ProfileLunge; mirrored?: boolean }) {
  const flip = mirrored ? "scale(-1, 1) translate(-160, 0)" : undefined;
  return (
    <G transform={flip}>
      {/* Trail leg (behind) */}
      <Limb from={p.trailHip} to={p.trailKnee} width={9} />
      <Limb from={p.trailKnee} to={p.trailFoot} width={8} />
      <Ellipse cx={p.trailFoot.x} cy={p.trailFoot.y + 2} rx={10} ry={4} fill={SHOE} opacity={0.85} />

      {/* Torso in profile */}
      <Path
        d={`M ${p.pelvis.x} ${p.pelvis.y} L ${p.chest.x} ${p.chest.y - 4} Q ${p.chest.x + 10} ${p.chest.y} ${p.chest.x + 6} ${p.pelvis.y}`}
        fill={SHIRT}
        stroke={OUTLINE}
        strokeWidth={2}
      />

      {/* Lead leg (front) */}
      <Limb from={p.leadHip} to={p.leadKnee} width={10} />
      <Limb from={p.leadKnee} to={p.leadFoot} width={9} />
      <Ellipse cx={p.leadFoot.x} cy={p.leadFoot.y + 2} rx={11} ry={4} fill={SHOE} />

      {/* Arm */}
      <Limb from={p.shoulder} to={p.elbow} width={8} />
      <Limb from={p.elbow} to={p.hand} width={7} />

      <Joint at={p.leadKnee} r={5} />
      <Joint at={p.trailKnee} r={4} />
      <Head at={p.head} />
    </G>
  );
}

function Limb({ from, to, width = 9 }: { from: Pt; to: Pt; width?: number }) {
  return (
    <Line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={OUTLINE} strokeWidth={width} strokeLinecap="round" />
  );
}

function Joint({ at, r = 4 }: { at: Pt; r?: number }) {
  return <Circle cx={at.x} cy={at.y} r={r} fill={SHIRT} stroke={OUTLINE} strokeWidth={1.5} />;
}

function Head({ at }: { at: Pt }) {
  return (
    <G>
      <Circle cx={at.x} cy={at.y} r={15} fill={SKIN} stroke={OUTLINE} strokeWidth={2} />
      <Circle cx={at.x - 4} cy={at.y - 2} r={2} fill={OUTLINE} />
      <Circle cx={at.x + 1} cy={at.y - 2} r={2} fill={OUTLINE} />
    </G>
  );
}

export function ExerciseDemoFigure({ width, height, pose }: Props) {
  const isLunge = pose.lungeStep > 0.001 || pose.lungeBend > 0.001;
  const isJack = pose.jackOpen > 0.001;
  const isSquat = pose.squatDepth > 0.001;

  return (
    <Svg width={width} height={height} viewBox="0 0 160 200">
      <Line x1={16} y1={GROUND_Y} x2={144} y2={GROUND_Y} stroke="#BDBDBD" strokeWidth={2} strokeLinecap="round" />
      <Ellipse cx={CX} cy={GROUND_Y + 2} rx={52} ry={5} fill="rgba(0,0,0,0.06)" />

      {isLunge ? (
        <ProfileLungeFigure
          p={buildProfileLunge(pose.lungeStep, pose.lungeBend)}
          mirrored={pose.lungeLeadLeg === "left"}
        />
      ) : isJack ? (
        <FrontFigure s={buildJackSkeleton(pose.jackOpen)} />
      ) : isSquat ? (
        <FrontFigure s={buildSquatSkeleton(pose.squatDepth, pose.footSpread)} />
      ) : (
        <FrontFigure s={buildStandSkeleton(pose.footSpread)} />
      )}
    </Svg>
  );
}

export const GateyMascot = ExerciseDemoFigure;
