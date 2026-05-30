import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import type { TaskPipeline } from "@/services/parentDashboardAnalytics";
import { useMemo } from "react";
import { useAppColors } from "@/theme/useAppColors";
import { radii } from "@/theme/theme";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

type Props = {
  pipeline: TaskPipeline;
};

export function TaskPipelineCard({ pipeline }: Props) {
  const c = useAppColors();
  const stages = useMemo(
    () =>
      [
        { key: "pending" as const, label: "Pending", icon: "clock-outline" as IconName, color: c.subtext },
        { key: "in_progress" as const, label: "In progress", icon: "progress-clock" as IconName, color: c.info },
        { key: "awaiting_review" as const, label: "Review", icon: "camera-account" as IconName, color: c.warning },
        { key: "completed" as const, label: "Done", icon: "check-circle" as IconName, color: c.primary },
      ] satisfies Array<{
        key: keyof TaskPipeline;
        label: string;
        icon: IconName;
        color: string;
      }>,
    [c]
  );

  return (
    <View style={styles.grid}>
      {stages.map((stage) => (
        <View
          key={stage.key}
          style={[styles.chip, { borderColor: `${stage.color}55`, backgroundColor: c.mutedSurface }]}
        >
          <MaterialCommunityIcons name={stage.icon} size={22} color={stage.color} />
          <Text variant="headlineSmall" style={[styles.count, { color: stage.color }]}>
            {pipeline[stage.key]}
          </Text>
          <Text variant="labelSmall" style={[styles.label, { color: c.subtext }]}>
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
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  count: { fontWeight: "800" },
  label: { textAlign: "center" },
});
