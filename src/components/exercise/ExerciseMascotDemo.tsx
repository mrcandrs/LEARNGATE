import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import type { ExerciseId } from "@/data/exercises";
import { MASCOT_NAME } from "@/constants/mascot";
import { useAppColors } from "@/theme/useAppColors";
import { radii, shadows } from "@/theme/theme";
import {
  ExerciseDemoFigure,
  NEUTRAL_FIGURE_POSE,
  type FigurePose,
} from "@/components/exercise/ExerciseDemoFigure";

const DEMO_CYCLES = 2;

type Props = {
  exerciseId: ExerciseId;
  exerciseTitle: string;
  onComplete: () => void;
};

type DemoStep = {
  caption: string;
  durationMs: number;
  poseAt: (t: number, cycle: number) => FigurePose;
};

function ease(t: number): number {
  return t * t * (3 - 2 * t);
}

function onlyJack(open: number): FigurePose {
  return { footSpread: 0, squatDepth: 0, jackOpen: open, armStretch: 0, armStretchSide: "right" };
}

function onlySquat(depth: number): FigurePose {
  return { footSpread: 1, squatDepth: depth, jackOpen: 0, armStretch: 0, armStretchSide: "right" };
}

function onlyArmStretch(amount: number, side: "left" | "right"): FigurePose {
  return { footSpread: 0.5, squatDepth: 0, jackOpen: 0, armStretch: amount, armStretchSide: side };
}

/**
 * Demo choreography for each exercise.
 * Arm stretch: left ×2 → right ×2 = 1 full rep.
 */
function buildSteps(exerciseId: ExerciseId): DemoStep[] {
  switch (exerciseId) {
    case "jumping_jacks":
      return [
        {
          caption: "Start — feet together, arms at your sides",
          durationMs: 750,
          poseAt: () => NEUTRAL_FIGURE_POSE,
        },
        {
          caption: "Jump! Legs out wide and both arms above your head",
          durationMs: 950,
          poseAt: (t) => onlyJack(ease(t)),
        },
        {
          caption: "Jump back — feet together, arms down. That's 1 rep!",
          durationMs: 950,
          poseAt: (t) => onlyJack(1 - ease(t)),
        },
      ];

    case "squats":
      return [
        {
          caption: "Stand tall — feet shoulder-width, chest up",
          durationMs: 900,
          poseAt: () => onlySquat(0),
        },
        {
          caption: "Push hips back and bend knees — thighs parallel to floor",
          durationMs: 1300,
          poseAt: (t) => onlySquat(ease(t)),
        },
        {
          caption: "Drive through your heels and stand up — that's 1 rep!",
          durationMs: 1300,
          poseAt: (t) => onlySquat(1 - ease(t)),
        },
      ];

    case "arm_stretching":
      return [
        {
          caption: "Stand tall — feet planted, arms at your sides",
          durationMs: 600,
          poseAt: () => NEUTRAL_FIGURE_POSE,
        },
        {
          caption: "Left arm up and over — stretch #1",
          durationMs: 900,
          poseAt: (t) => onlyArmStretch(ease(t), "left"),
        },
        {
          caption: "Arms down",
          durationMs: 700,
          poseAt: (t) => onlyArmStretch(1 - ease(t), "left"),
        },
        {
          caption: "Left arm again — stretch #2",
          durationMs: 900,
          poseAt: (t) => onlyArmStretch(ease(t), "left"),
        },
        {
          caption: "Arms down — now switch sides",
          durationMs: 700,
          poseAt: (t) => onlyArmStretch(1 - ease(t), "left"),
        },
        {
          caption: "Right arm up and over — stretch #1",
          durationMs: 900,
          poseAt: (t) => onlyArmStretch(ease(t), "right"),
        },
        {
          caption: "Arms down",
          durationMs: 700,
          poseAt: (t) => onlyArmStretch(1 - ease(t), "right"),
        },
        {
          caption: "Right arm again — stretch #2",
          durationMs: 900,
          poseAt: (t) => onlyArmStretch(ease(t), "right"),
        },
        {
          caption: "Arms down — that's 1 rep!",
          durationMs: 700,
          poseAt: (t) => onlyArmStretch(1 - ease(t), "right"),
        },
      ];
  }
}

export function ExerciseMascotDemo({ exerciseId, exerciseTitle, onComplete }: Props) {
  const c = useAppColors();
  const progress = useRef(new Animated.Value(0)).current;
  const [stepIndex, setStepIndex] = useState(0);
  const [cycle, setCycle] = useState(1);
  const [pose, setPose] = useState<FigurePose>(NEUTRAL_FIGURE_POSE);

  useEffect(() => {
    let mounted = true;
    let currentStep = 0;
    let currentCycle = 1;
    const demoSteps = buildSteps(exerciseId);

    const runStep = () => {
      if (!mounted) return;
      setStepIndex(currentStep);
      setCycle(currentCycle);
      progress.setValue(0);

      const step = demoSteps[currentStep];
      Animated.timing(progress, {
        toValue: 1,
        duration: step?.durationMs ?? 900,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (!finished || !mounted) return;
        currentStep += 1;
        if (currentStep >= demoSteps.length) {
          currentStep = 0;
          currentCycle += 1;
          if (currentCycle > DEMO_CYCLES) {
            onComplete();
            return;
          }
        }
        runStep();
      });
    };

    const listenerId = progress.addListener(({ value }) => {
      const step = demoSteps[currentStep];
      if (step) setPose(step.poseAt(value, currentCycle));
    });

    runStep();

    return () => {
      mounted = false;
      progress.removeListener(listenerId);
      progress.stopAnimation();
    };
  }, [exerciseId, onComplete, progress]);

  const steps = buildSteps(exerciseId);
  const caption = steps[stepIndex]?.caption ?? `Watch how to do ${exerciseTitle}`;

  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <Text variant="titleSmall" style={{ color: c.primaryDark, fontWeight: "800", textAlign: "center" }}>
        {MASCOT_NAME} shows you how
      </Text>
      <Text variant="bodySmall" style={{ color: c.subtext, textAlign: "center", marginTop: 4 }}>
        Copy each move, then open the camera for your turn
      </Text>

      <View style={[styles.stage, { backgroundColor: "#F1F8F4" }]}>
        <ExerciseDemoFigure width={280} height={330} pose={pose} />
      </View>

      <View style={[styles.captionBox, { backgroundColor: c.primary }]}>
        <Text style={styles.captionText}>{caption}</Text>
        <Text style={styles.cycleText}>
          Demo rep {Math.min(cycle, DEMO_CYCLES)} of {DEMO_CYCLES}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    ...shadows.card,
  },
  stage: {
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    minHeight: 340,
  },
  captionBox: {
    borderRadius: radii.md,
    padding: 12,
    alignItems: "center",
  },
  captionText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
    textAlign: "center",
  },
  cycleText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "600",
  },
});
