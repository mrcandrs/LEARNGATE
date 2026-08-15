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
import { useLocale } from "@/store/LocaleContext";
import type { TranslateFn } from "@/i18n/helpers";

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
function buildSteps(exerciseId: ExerciseId, t: TranslateFn): DemoStep[] {
  switch (exerciseId) {
    case "jumping_jacks":
      return [
        {
          caption: t("child.exercise.demo.jacksStart"),
          durationMs: 750,
          poseAt: () => NEUTRAL_FIGURE_POSE,
        },
        {
          caption: t("child.exercise.demo.jacksJump"),
          durationMs: 950,
          poseAt: (progress) => onlyJack(ease(progress)),
        },
        {
          caption: t("child.exercise.demo.jacksBack"),
          durationMs: 950,
          poseAt: (progress) => onlyJack(1 - ease(progress)),
        },
      ];

    case "squats":
      return [
        {
          caption: t("child.exercise.demo.squatStart"),
          durationMs: 900,
          poseAt: () => onlySquat(0),
        },
        {
          caption: t("child.exercise.demo.squatDown"),
          durationMs: 1300,
          poseAt: (progress) => onlySquat(ease(progress)),
        },
        {
          caption: t("child.exercise.demo.squatUp"),
          durationMs: 1300,
          poseAt: (progress) => onlySquat(1 - ease(progress)),
        },
      ];

    case "arm_stretching":
      return [
        {
          caption: t("child.exercise.demo.stretchStart"),
          durationMs: 600,
          poseAt: () => NEUTRAL_FIGURE_POSE,
        },
        {
          caption: t("child.exercise.demo.stretchLeft1"),
          durationMs: 900,
          poseAt: (progress) => onlyArmStretch(ease(progress), "left"),
        },
        {
          caption: t("child.exercise.demo.stretchArmsDown"),
          durationMs: 700,
          poseAt: (progress) => onlyArmStretch(1 - ease(progress), "left"),
        },
        {
          caption: t("child.exercise.demo.stretchLeft2"),
          durationMs: 900,
          poseAt: (progress) => onlyArmStretch(ease(progress), "left"),
        },
        {
          caption: t("child.exercise.demo.stretchSwitch"),
          durationMs: 700,
          poseAt: (progress) => onlyArmStretch(1 - ease(progress), "left"),
        },
        {
          caption: t("child.exercise.demo.stretchRight1"),
          durationMs: 900,
          poseAt: (progress) => onlyArmStretch(ease(progress), "right"),
        },
        {
          caption: t("child.exercise.demo.stretchArmsDown"),
          durationMs: 700,
          poseAt: (progress) => onlyArmStretch(1 - ease(progress), "right"),
        },
        {
          caption: t("child.exercise.demo.stretchRight2"),
          durationMs: 900,
          poseAt: (progress) => onlyArmStretch(ease(progress), "right"),
        },
        {
          caption: t("child.exercise.demo.stretchDone"),
          durationMs: 700,
          poseAt: (progress) => onlyArmStretch(1 - ease(progress), "right"),
        },
      ];
  }
}

export function ExerciseMascotDemo({ exerciseId, exerciseTitle, onComplete }: Props) {
  const c = useAppColors();
  const { t } = useLocale();
  const progress = useRef(new Animated.Value(0)).current;
  const [stepIndex, setStepIndex] = useState(0);
  const [cycle, setCycle] = useState(1);
  const [pose, setPose] = useState<FigurePose>(NEUTRAL_FIGURE_POSE);

  useEffect(() => {
    let mounted = true;
    let currentStep = 0;
    let currentCycle = 1;
    const demoSteps = buildSteps(exerciseId, t);

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
  }, [exerciseId, onComplete, progress, t]);

  const steps = buildSteps(exerciseId, t);
  const caption = steps[stepIndex]?.caption ?? t("child.exercise.demo.watchHow", { title: exerciseTitle });

  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <Text variant="titleSmall" style={{ color: c.primaryDark, fontWeight: "800", textAlign: "center" }}>
        {t("child.exercise.gateyShows", { name: MASCOT_NAME })}
      </Text>
      <Text variant="bodySmall" style={{ color: c.subtext, textAlign: "center", marginTop: 4 }}>
        {t("child.exercise.gateyHint")}
      </Text>

      <View style={[styles.stage, { backgroundColor: "#F1F8F4" }]}>
        <ExerciseDemoFigure width={280} height={330} pose={pose} />
      </View>

      <View style={[styles.captionBox, { backgroundColor: c.primary }]}>
        <Text style={styles.captionText}>{caption}</Text>
        <Text style={styles.cycleText}>
          {t("child.exercise.demoRep", { current: Math.min(cycle, DEMO_CYCLES), total: DEMO_CYCLES })}
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
