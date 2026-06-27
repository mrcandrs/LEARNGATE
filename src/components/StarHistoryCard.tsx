import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  formatWeekRangeLabel,
  type WeeklyStarSnapshot,
} from "@/services/weeklyStarSnapshots";
import { formatAppTimeShort } from "@/services/parentDashboardAnalytics";
import { useAppColors } from "@/theme/useAppColors";
import { radii, shadows } from "@/theme/theme";

type Props = {
  history: WeeklyStarSnapshot[];
  starsThisWeek: number;
  starsLifetime: number;
  loading?: boolean;
  /** When set, shown in the card title (parent view). */
  childName?: string;
};

export function StarHistoryCard({
  history,
  starsThisWeek,
  starsLifetime,
  loading = false,
  childName,
}: Props) {
  const c = useAppColors();
  const title = childName ? `${childName}'s Star History` : "Star History";

  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="history" size={22} color={c.primaryDark} />
        <Text style={[styles.title, { color: c.primaryDark }]}>{title}</Text>
      </View>

      <View style={[styles.summaryRow, { backgroundColor: c.surfaceTint }]}>
        <SummaryChip label="This week" value={`${starsThisWeek} ★`} accent={c.warning} />
        <SummaryChip label="All time" value={`${starsLifetime} ★`} accent={c.primary} />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={c.primary} />
      ) : history.length === 0 ? (
        <Text style={[styles.empty, { color: c.subtext }]}>
          No closed weeks yet. After each Monday midnight (Manila time), last week&apos;s stars appear here.
        </Text>
      ) : (
        <View style={styles.list}>
          {history.map((row) => (
            <View key={row.week_start} style={[styles.row, { borderTopColor: c.border }]}>
              <View style={styles.rowMain}>
                <Text style={[styles.weekLabel, { color: c.text }]}>
                  {formatWeekRangeLabel(row.week_start, row.week_end)}
                </Text>
                <Text style={[styles.starsValue, { color: c.warning }]}>
                  {row.stars_at_reset} stars
                </Text>
              </View>
              <Text style={[styles.meta, { color: c.subtext }]}>
                {row.tasks_completed} tasks · {formatAppTimeShort(row.app_time_seconds)} app time
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function SummaryChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={[styles.chipValue, { color: accent }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    ...shadows.card,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
  },
  summaryRow: {
    flexDirection: "row",
    borderRadius: radii.sm,
    padding: 12,
    gap: 16,
  },
  chip: {
    flex: 1,
    gap: 2,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: "600",
    opacity: 0.75,
  },
  chipValue: {
    fontSize: 20,
    fontWeight: "800",
  },
  loader: {
    marginVertical: 12,
  },
  empty: {
    fontSize: 14,
    lineHeight: 20,
  },
  list: {
    gap: 0,
  },
  row: {
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 4,
  },
  rowMain: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  weekLabel: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  starsValue: {
    fontSize: 15,
    fontWeight: "800",
  },
  meta: {
    fontSize: 12,
  },
});
