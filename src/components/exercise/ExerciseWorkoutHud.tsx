import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { useLocale } from "@/store/LocaleContext";
import { ExerciseGoalStar } from "@/components/exercise/ExerciseGoalStar";

type Props = {
  remaining: number;
  completed: number;
  targetReps: number;
};

/** Compact floating HUD — remaining reps and a progress bar with a prize goal star. */
export const ExerciseWorkoutHud = memo(function ExerciseWorkoutHud({
  remaining,
  completed,
  targetReps,
}: Props) {
  const { t } = useLocale();
  const progress = targetReps > 0 ? Math.min(1, completed / targetReps) : 0;
  const goalReached = progress >= 1;

  return (
    <View style={styles.row} pointerEvents="box-none">
      <View style={styles.repPill}>
        <Text style={styles.repPillLabel}>{t("child.exercise.left")}</Text>
        <Text style={styles.repPillNum}>{String(remaining).padStart(2, "0")}</Text>
      </View>
      <View style={styles.centerPill}>
        <Text style={styles.progressLabel}>
          {completed}/{targetReps}
        </Text>
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <ExerciseGoalStar reached={goalReached} size="lg" />
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  repPill: {
    backgroundColor: "rgba(0,0,0,0.62)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    minWidth: 64,
  },
  repPillLabel: { color: "rgba(255,255,255,0.85)", fontSize: 10, fontWeight: "600" },
  repPillNum: { color: "#FFFFFF", fontSize: 24, fontWeight: "900" },
  centerPill: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: "center",
    gap: 4,
  },
  progressLabel: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  progressTrack: {
    flex: 1,
    height: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.22)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#4CAF50",
  },
});
