import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import type { TaskPipeline } from "@/services/parentDashboardAnalytics";
import { colors, radii } from "@/theme/theme";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

const STAGES: Array<{
  key: keyof TaskPipeline;
  label: string;
  icon: IconName;
  color: string;
}> = [
  { key: "pending", label: "Pending", icon: "clock-outline", color: colors.subtext },
  { key: "in_progress", label: "In progress", icon: "progress-clock", color: colors.info },
  { key: "awaiting_review", label: "Review", icon: "camera-account", color: colors.warning },
  { key: "completed", label: "Done", icon: "check-circle", color: colors.primary },
];

type Props = {
  pipeline: TaskPipeline;
};

export function TaskPipelineCard({ pipeline }: Props) {
  return (
    <View style={styles.grid}>
      {STAGES.map((stage) => (
        <View key={stage.key} style={[styles.chip, { borderColor: `${stage.color}55` }]}>
          <MaterialCommunityIcons name={stage.icon} size={22} color={stage.color} />
          <Text variant="headlineSmall" style={[styles.count, { color: stage.color }]}>
            {pipeline[stage.key]}
          </Text>
          <Text variant="labelSmall" style={styles.label}>
            {stage.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    width: "47%",
    backgroundColor: "#F9FAFB",
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  count: { fontWeight: "800" },
  label: { color: colors.subtext, textAlign: "center" },
});
