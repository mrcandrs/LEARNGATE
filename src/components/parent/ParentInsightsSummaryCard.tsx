import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import type { WeekAnalytics } from "@/services/parentDashboardAnalytics";
import { formatGeneratedAgo } from "@/services/parentInsights";
import { useAppColors } from "@/theme/useAppColors";
import { radii, shadows } from "@/theme/theme";

export type ParentChildInsight = {
  childName: string;
  summary: string;
  latestTaskLine: string;
  focusAreas: string;
  recommendation: string;
  nextBestStep: string;
};

type ParentInsightsSummaryCardProps = {
  week: WeekAnalytics;
  insight: ParentChildInsight | null;
  generatedAt?: string;
  expanded: boolean;
  loading?: boolean;
  onTogglePlan: () => void;
};

export function ParentInsightsSummaryCard({
  week,
  insight,
  generatedAt,
  expanded,
  loading = false,
  onTogglePlan,
}: ParentInsightsSummaryCardProps) {
  const c = useAppColors();
  const generatedLabel = formatGeneratedAgo(generatedAt);
  const trendLine =
    week.totalCompleted > week.priorWeekCompleted
      ? "Completions improved from last week"
      : week.totalCompleted < week.priorWeekCompleted
        ? "Completions dipped vs last week"
        : week.trendLabel;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.sectionTitle, { color: c.primaryDark }]}>AI-Assisted Insights</Text>
      <View style={[styles.card, { backgroundColor: c.insightCardBg, borderColor: c.insightCardBorder }]}>
        <View style={styles.topRow}>
          <View style={styles.summaryCol}>
            <Text style={[styles.kicker, { color: c.primaryDark }]}>This week summary</Text>
            <Text style={[styles.bigNumber, { color: c.primaryDark }]}>{week.totalCompleted}</Text>
            <Text style={[styles.trend, { color: c.primaryDark }]}>{trendLine}</Text>
          </View>
          <Pressable
            onPress={onTogglePlan}
            style={[styles.planBtn, { backgroundColor: c.primaryDark }]}
            accessibilityRole="button"
            accessibilityLabel={expanded ? "Hide more insights" : "View more insights"}
          >
            <Text style={styles.planBtnText}>{expanded ? "Hide More" : "View More"}</Text>
          </Pressable>
        </View>

        {expanded ? (
          <View style={[styles.detail, { borderTopColor: c.insightCardBorder }]}>
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={c.primary} />
                <Text style={{ color: c.subtext }}>Generating personalized insight…</Text>
              </View>
            ) : insight ? (
              <>
                <Text style={[styles.detailName, { color: c.primaryDark }]}>{insight.childName}</Text>
                <Text style={[styles.detailLine, { color: c.subtext }]}>{insight.summary}</Text>
                <Text style={[styles.detailLine, { color: c.subtext }]}>{insight.latestTaskLine}</Text>
                <Text style={styles.detailFocus}>{insight.focusAreas}</Text>
                <Text style={[styles.detailRec, { color: c.text }]}>{insight.recommendation}</Text>
                <Text style={[styles.detailStep, { color: c.primaryDark }]}>{insight.nextBestStep}</Text>
              </>
            ) : (
              <Text style={{ color: c.subtext }}>Could not load insight. Pull to refresh and try again.</Text>
            )}
            <Text style={[styles.poweredBy, { color: c.subtext }]}>Powered by Google Gemini</Text>
            {generatedLabel && !loading ? (
              <Text style={[styles.generatedAt, { color: c.subtext }]}>{generatedLabel}</Text>
            ) : null}
            <Text style={[styles.aiNote, { color: c.subtext }]}>
              Recommendations are AI-generated from recent in-app behavior. Tap View More to refresh.
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  card: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    ...shadows.card,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  summaryCol: {
    flex: 1,
    gap: 2,
  },
  kicker: {
    fontSize: 12,
    fontWeight: "700",
  },
  bigNumber: {
    fontSize: 36,
    fontWeight: "800",
    lineHeight: 40,
  },
  trend: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  planBtn: {
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  planBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  detail: {
    borderTopWidth: 1,
    paddingTop: 14,
    gap: 8,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  detailName: {
    fontWeight: "800",
    fontSize: 18,
  },
  detailLine: {
    fontSize: 16,
    lineHeight: 24,
  },
  detailFocus: {
    color: "#7C3AED",
    fontWeight: "600",
    fontSize: 16,
    lineHeight: 24,
  },
  detailRec: {
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 25,
  },
  detailStep: {
    fontWeight: "700",
    fontSize: 17,
    lineHeight: 25,
  },
  poweredBy: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.2,
    marginTop: 8,
  },
  generatedAt: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 2,
  },
  aiNote: {
    fontStyle: "italic",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
});
