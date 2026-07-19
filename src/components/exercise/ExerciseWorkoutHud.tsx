import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { MoveStatus } from "@/services/exerciseRepDetection";

type Props = {
  remaining: number;
  completed: number;
  moveStatus: MoveStatus;
  onStop: () => void;
  done: boolean;
  /** Shown so testers know the new Pose AI build is loaded. */
  engineLabel?: string;
};

/** Compact floating HUD — keeps the camera viewport tall for leg exercises. */
export function ExerciseWorkoutHud({
  remaining,
  completed,
  moveStatus,
  onStop,
  done,
  engineLabel,
}: Props) {
  const moveLabel =
    moveStatus === "Rep!"
      ? "Rep!"
      : moveStatus === "Move!"
        ? "Move!"
        : moveStatus === "Watching"
          ? "Watching"
          : "Stopped";

  return (
    <View style={styles.row} pointerEvents="box-none">
      <View style={styles.repPill}>
        <Text style={styles.repPillLabel}>Left</Text>
        <Text style={styles.repPillNum}>{String(remaining).padStart(2, "0")}</Text>
      </View>
      <View style={styles.centerPill}>
        <Text style={styles.centerDone}>{completed} done</Text>
        <Text style={styles.centerStatus}>{moveLabel}</Text>
        {engineLabel ? <Text style={styles.engineLabel}>{engineLabel}</Text> : null}
      </View>
      <Pressable
        onPress={onStop}
        disabled={done}
        style={[styles.stopBtn, done && styles.stopBtnDisabled]}
        accessibilityRole="button"
        accessibilityLabel="Stop workout"
      >
        <MaterialCommunityIcons name="stop-circle-outline" size={22} color="#FFFFFF" />
        <Text style={styles.stopText}>Stop</Text>
      </Pressable>
    </View>
  );
}

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
  centerStatus: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
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
