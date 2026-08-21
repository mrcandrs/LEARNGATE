import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocale } from "@/store/LocaleContext";

type Props = {
  remaining: number;
  completed: number;
  targetReps: number;
  onStop: () => void;
  done: boolean;
};

/** Compact floating HUD — remaining reps, progress bar, stop. */
export const ExerciseWorkoutHud = memo(function ExerciseWorkoutHud({
  remaining,
  completed,
  targetReps,
  onStop,
  done,
}: Props) {
  const { t } = useLocale();
  const progress = targetReps > 0 ? Math.min(1, completed / targetReps) : 0;

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
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
      </View>
      <Pressable
        onPress={onStop}
        disabled={done}
        style={[styles.stopBtn, done && styles.stopBtnDisabled]}
        accessibilityRole="button"
        accessibilityLabel={t("child.exercise.stopWorkout")}
      >
        <MaterialCommunityIcons name="stop-circle-outline" size={22} color="#FFFFFF" />
        <Text style={styles.stopText}>{t("child.exercise.stop")}</Text>
      </Pressable>
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: "center",
    gap: 6,
  },
  progressLabel: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.22)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#4CAF50",
  },
  stopBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(220, 38, 38, 0.85)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  stopBtnDisabled: { opacity: 0.5 },
  stopText: { color: "#FFFFFF", fontWeight: "800", fontSize: 13 },
});
