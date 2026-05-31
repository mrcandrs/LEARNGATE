import { useCallback, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { StatCard } from "@/components/StatCard";
import { CategoryBarChart } from "@/components/parent/CategoryBarChart";
import { TaskPipelineCard } from "@/components/parent/TaskPipelineCard";
import type { ParentDashboardAnalytics } from "@/services/parentDashboardAnalytics";
import type { ParentStat } from "@/types/app";
import { useAppColors } from "@/theme/useAppColors";
import type { AppColors } from "@/theme/theme";
import { radii, shadows } from "@/theme/theme";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

function statIcons(c: AppColors): Record<string, { icon: IconName; color: string }> {
  return {
    "Children Managed": { icon: "account-group-outline", color: c.primary },
    "Active Now": { icon: "access-point", color: c.primary },
    "Pending Reviews": { icon: "clipboard-text-clock-outline", color: c.warning },
    "Completed This Week": { icon: "check-circle-outline", color: c.info },
  };
}

type ParentDashboardCarouselProps = {
  stats: ParentStat[];
  analytics: ParentDashboardAnalytics;
};

const SLIDE_COUNT = 3;

export function ParentDashboardCarousel({ stats, analytics }: ParentDashboardCarouselProps) {
  const c = useAppColors();
  const icons = useMemo(() => statIcons(c), [c]);
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const slideWidth = useMemo(() => Dimensions.get("window").width - 32, []);

  const pipelineProgressPct = useMemo(() => {
    const p = analytics.pipeline;
    const total = p.pending + p.in_progress + p.awaiting_review + p.completed;
    if (total === 0) return 0;
    return Math.round((p.completed / total) * 100);
  }, [analytics.pipeline]);

  const onScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / slideWidth);
      setPage(Math.max(0, Math.min(SLIDE_COUNT - 1, next)));
    },
    [slideWidth]
  );

  const goToPage = (next: number) => {
    const clamped = Math.max(0, Math.min(SLIDE_COUNT - 1, next));
    scrollRef.current?.scrollTo({ x: clamped * slideWidth, animated: true });
    setPage(clamped);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: c.primaryDark }]}>Dashboard Overview</Text>
        <View style={styles.arrows}>
          <Pressable
            onPress={() => goToPage(page - 1)}
            disabled={page === 0}
            style={[styles.arrowBtn, { borderColor: c.border, backgroundColor: c.card }, page === 0 && styles.arrowBtnDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Previous overview panel"
          >
            <MaterialCommunityIcons name="chevron-left" size={20} color={c.primaryDark} />
          </Pressable>
          <Pressable
            onPress={() => goToPage(page + 1)}
            disabled={page === SLIDE_COUNT - 1}
            style={[
              styles.arrowBtn,
              { borderColor: c.border, backgroundColor: c.card },
              page === SLIDE_COUNT - 1 && styles.arrowBtnDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Next overview panel"
          >
            <MaterialCommunityIcons name="chevron-right" size={20} color={c.primaryDark} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        decelerationRate="fast"
      >
        <View style={[styles.slide, { width: slideWidth }]}>
          <View style={[styles.panelCard, { borderColor: c.border, backgroundColor: c.card }]}>
            <View style={styles.panelHeader}>
              <Text style={[styles.panelTitle, { color: c.primaryDark }]}>Summary</Text>
              <View style={[styles.pill, { backgroundColor: c.surfaceTint }]}>
                <Text style={[styles.pillText, { color: c.primaryDark }]}>Overview</Text>
              </View>
            </View>
            <View style={styles.statGrid}>
              {stats.map((item) => {
                const meta = icons[item.label];
                const displayLabel =
                  item.label === "Completed This Week" ? "Done This Week" : item.label;
                return (
                  <View key={item.label} style={styles.statCell}>
                    <StatCard
                      label={displayLabel}
                      value={item.value}
                      iconName={meta?.icon ?? "chart-box-outline"}
                      iconColor={meta?.color ?? c.primary}
                    />
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        <View style={[styles.slide, { width: slideWidth }]}>
          <View style={[styles.panelCard, { borderColor: c.border, backgroundColor: c.card }]}>
            <View style={styles.panelHeader}>
              <Text style={[styles.panelTitle, { color: c.primaryDark }]}>Task Pipeline</Text>
              <View style={[styles.pill, { backgroundColor: c.surfaceTint }]}>
                <Text style={[styles.pillText, { color: c.primaryDark }]}>Today</Text>
              </View>
            </View>
            <TaskPipelineCard pipeline={analytics.pipeline} />
            <View style={styles.progressBlock}>
              <View style={styles.progressLabels}>
                <Text style={[styles.progressLabel, { color: c.subtext }]}>Weekly progress</Text>
                <Text style={[styles.progressPct, { color: c.primaryDark }]}>{pipelineProgressPct}%</Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: c.progressTrack }]}>
                <View
                  style={[styles.progressFill, { width: `${pipelineProgressPct}%`, backgroundColor: c.primary }]}
                />
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.slide, { width: slideWidth }]}>
          <View style={[styles.panelCard, { borderColor: c.border, backgroundColor: c.card }]}>
            <View style={styles.panelHeader}>
              <Text style={[styles.panelTitle, { color: c.primaryDark }]}>Weekly Analytics</Text>
              <View style={[styles.pill, { backgroundColor: c.surfaceTint }]}>
                <Text style={[styles.pillText, { color: c.primaryDark }]}>Report</Text>
              </View>
            </View>
            <View style={styles.weekHighlightRow}>
              <View style={[styles.weekHighlight, { backgroundColor: c.surfaceTint }]}>
                <Text style={[styles.weekNumber, { color: c.primaryDark }]}>{analytics.week.totalCompleted}</Text>
                <Text style={[styles.weekLabel, { color: c.subtext }]}>Completions</Text>
              </View>
              <View style={[styles.weekHighlight, { backgroundColor: c.surfaceTint }]}>
                <Text style={[styles.weekNumber, { color: c.primaryDark }]}>{analytics.week.pointsThisWeek}</Text>
                <Text style={[styles.weekLabel, { color: c.subtext }]}>Activity Points</Text>
              </View>
            </View>
            <CategoryBarChart
              learning={analytics.week.byCategory.learning}
              exercise={analytics.week.byCategory.exercise}
              chore={analytics.week.byCategory.chore}
            />
            <Text style={[styles.trendNote, { color: c.subtext }]}>{analytics.week.trendLabel}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.dots}>
        {Array.from({ length: SLIDE_COUNT }).map((_, index) => (
          <View
            key={index}
            style={[styles.dot, page === index && [styles.dotActive, { backgroundColor: c.primary }]]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
    marginTop: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  arrows: {
    flexDirection: "row",
    gap: 8,
  },
  arrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowBtnDisabled: {
    opacity: 0.45,
  },
  slide: {
    paddingRight: 0,
  },
  panelCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 14,
    gap: 14,
    ...shadows.card,
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  pill: {
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCell: {
    width: "47%",
  },
  progressBlock: {
    gap: 8,
    marginTop: 4,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressLabel: {
    fontWeight: "600",
    fontSize: 13,
  },
  progressPct: {
    fontWeight: "800",
    fontSize: 14,
  },
  progressTrack: {
    height: 10,
    borderRadius: radii.pill,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: radii.pill,
    minWidth: 4,
  },
  weekHighlightRow: {
    flexDirection: "row",
    gap: 10,
  },
  weekHighlight: {
    flex: 1,
    borderRadius: radii.sm,
    paddingVertical: 14,
    alignItems: "center",
    gap: 4,
  },
  weekNumber: {
    fontSize: 28,
    fontWeight: "800",
  },
  weekLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  trendNote: {
    fontSize: 12,
    fontStyle: "italic",
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#D1D5DB",
  },
  dotActive: {
    width: 22,
  },
});
