import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import type { ChildMonitor } from "@/services/parentDashboardAnalytics";
import { colors, radii } from "@/theme/theme";

type Props = {
  monitor: ChildMonitor;
};

export function ChildMonitorCard({ monitor }: Props) {
  const statusColor = monitor.isOnline ? colors.primary : colors.subtext;
  const statusIcon = monitor.isOnline ? "circle" : "circle-outline";

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.nameRow}>
          <MaterialCommunityIcons name="account-child" size={22} color={colors.primaryDark} />
          <Text variant="titleSmall" style={styles.name}>
            {monitor.childName}
          </Text>
        </View>
        <View style={[styles.badge, monitor.isOnline && styles.badgeOnline]}>
          <MaterialCommunityIcons name={statusIcon} size={10} color={statusColor} />
          <Text variant="labelSmall" style={[styles.badgeText, { color: statusColor }]}>
            {monitor.lastSeenLabel}
          </Text>
        </View>
      </View>

      <View style={styles.metrics}>
        <Metric icon="clipboard-list-outline" label="Active" value={String(monitor.activeTasks)} />
        <Metric icon="check-decagram-outline" label="This week" value={String(monitor.completedThisWeek)} />
        <Metric icon="star" label="Stars" value={String(monitor.stars)} color={colors.warning} />
        <Metric
          icon="camera-outline"
          label="Review"
          value={String(monitor.pendingReview)}
          color={monitor.pendingReview > 0 ? "#B45309" : colors.subtext}
        />
      </View>

      <View style={styles.footer}>
        <Text variant="labelSmall" style={styles.footerText}>
          {monitor.completionRatePct}% completion ·{" "}
          {monitor.hasLinkedAccount ? "App linked" : "No child login yet"}
        </Text>
      </View>
    </View>
  );
}

function Metric({
  icon,
  label,
  value,
  color = colors.text,
}: {
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={styles.metric}>
      <MaterialCommunityIcons name={icon} size={16} color={color} />
      <Text variant="labelLarge" style={[styles.metricValue, { color }]}>
        {value}
      </Text>
      <Text variant="labelSmall" style={styles.metricLabel}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#F8FAFC",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 10,
    minWidth: 260,
  },
  header: { gap: 8 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { fontWeight: "700", color: colors.text, flex: 1 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: "#E5E7EB",
  },
  badgeOnline: { backgroundColor: "#DCFCE7" },
  badgeText: { fontWeight: "600" },
  metrics: { flexDirection: "row", justifyContent: "space-between" },
  metric: { alignItems: "center", gap: 2, flex: 1 },
  metricValue: { fontWeight: "700" },
  metricLabel: { color: colors.subtext },
  footer: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  footerText: { color: colors.subtext },
});
