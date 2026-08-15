import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { formQualityColor, type PoseFormQuality } from "@/services/exercisePoseFormQuality";
import { useLocale } from "@/store/LocaleContext";

type Props = {
  remaining: number;
  completed: number;
  /** Kid-facing coaching line (same as the frame status). */
  statusMessage: string;
  quality: PoseFormQuality;
  onStop: () => void;
  done: boolean;
  /** Optional tracking label (dev builds may include a version stamp). */
  engineLabel?: string;
};

/** Compact floating HUD — keeps the camera viewport tall for leg exercises. */
export const ExerciseWorkoutHud = memo(function ExerciseWorkoutHud({
  remaining,
  completed,
  statusMessage,
  quality,
  onStop,
  done,
  engineLabel,
}: Props) {
  const { t } = useLocale();
  const statusColor = formQualityColor(quality === "none" ? "red" : quality);

  return (
    <View style={styles.row} pointerEvents="box-none">
      <View style={styles.repPill}>
        <Text style={styles.repPillLabel}>{t("child.exercise.left")}</Text>
        <Text style={styles.repPillNum}>{String(remaining).padStart(2, "0")}</Text>
      </View>
      <View style={styles.centerPill}>
        <Text style={styles.centerDone}>{t("child.exercise.doneCount", { count: completed })}</Text>
        <Text style={[styles.centerStatus, { color: statusColor }]} numberOfLines={2}>
          {statusMessage || t("child.exercise.getReady")}
        </Text>
        {engineLabel ? <Text style={styles.engineLabel}>{engineLabel}</Text> : null}
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
    paddingVertical: 8,
    alignItems: "center",
  },
  centerDone: { color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "600" },
  centerStatus: { fontSize: 14, fontWeight: "800", textAlign: "center" },
  engineLabel: { color: "rgba(255,255,255,0.65)", fontSize: 9, fontWeight: "600", marginTop: 2 },
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
