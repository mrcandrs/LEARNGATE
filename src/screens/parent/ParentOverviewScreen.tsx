import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Card, Menu, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { ScreenContainer } from "@/components/ScreenContainer";
import { StatCard } from "@/components/StatCard";
import { CategoryBarChart } from "@/components/parent/CategoryBarChart";
import { ChildMonitorCard } from "@/components/parent/ChildMonitorCard";
import { TaskPipelineCard } from "@/components/parent/TaskPipelineCard";
import { useAuth } from "@/store/AuthContext";
import { colors, radii, shadows } from "@/theme/theme";
import { ParentStat } from "@/types/app";
import { supabase } from "@/services/supabase";
import {
  buildParentDashboardAnalytics,
  type ChildRow,
  type ParentDashboardAnalytics,
  type TaskRow,
} from "@/services/parentDashboardAnalytics";
import { formatAppError } from "@/utils/errors";
import { hasMyPushToken, registerAndSavePushToken } from "@/services/pushNotifications";

type ActivityItem = {
  id: string;
  type: string;
  points: number;
  metadata: Record<string, unknown>;
  created_at: string;
};

type ChildInsight = {
  childId: string;
  childName: string;
  summary: string;
  latestTaskLine: string;
  focusAreas: string;
  nextBestStep: string;
  recommendation: string;
};

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

const STAT_ICONS: Record<string, { icon: IconName; color: string }> = {
  "Children Managed": { icon: "account-group-outline", color: colors.primary },
  "Active Now": { icon: "access-point", color: colors.primary },
  "Pending Reviews": { icon: "camera-account", color: colors.warning },
  "Completed This Week": { icon: "calendar-check", color: colors.info },
};

const ACTIVITY_ICONS: Record<string, IconName> = {
  task_completed: "check-circle-outline",
  task_assigned: "clipboard-plus-outline",
  chore_approved: "thumb-up-outline",
  stars_earned: "star-outline",
  game_milestone: "gamepad-variant-outline",
};

function formatActivityTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 86_400_000) {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function buildInsights(children: ChildRow[], rows: TaskRow[]): ChildInsight[] {
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  return children.map((c) => {
    const childRows = rows.filter((r) => r.child_id === c.id);
    const completedRows = childRows.filter((r) => r.status === "completed");
    const completed7 = completedRows.filter(
      (r) => r.completed_at && now - new Date(r.completed_at).getTime() <= sevenDaysMs
    );
    const activeCount = childRows.filter((r) => r.status !== "completed").length;

    const learningDone = completed7.filter((r) => r.category === "learning").length;
    const exerciseDone = completed7.filter((r) => r.category === "exercise").length;
    const choreDone = completed7.filter((r) => r.category === "chore").length;
    const learningTitles7 = completed7
      .filter((r) => r.category === "learning")
      .map((r) => r.title?.toLowerCase() ?? "");
    const mathDone = learningTitles7.filter((t) => t.includes("math") || t.includes("number")).length;
    const readingDone = learningTitles7.filter((t) => t.includes("alphabet") || t.includes("read")).length;
    const scienceDone = learningTitles7.filter((t) => t.includes("science")).length;
    const latestCompleted = [...completedRows].sort(
      (a, b) =>
        new Date(b.completed_at ?? b.created_at).getTime() -
        new Date(a.completed_at ?? a.created_at).getTime()
    )[0];

    const screenLimitHours = Math.round((c.daily_limit_minutes ?? 0) / 60);
    const summary = `${completed7.length} tasks completed this week · ${activeCount} active tasks · screen limit ${screenLimitHours}h/day`;
    const latestTaskLine = latestCompleted
      ? `Latest completion: ${latestCompleted.title} (${latestCompleted.category})`
      : "Latest completion: none yet";

    const weakCategories: string[] = [];
    if (learningDone === 0) weakCategories.push("learning");
    if (exerciseDone === 0) weakCategories.push("exercise");
    if (choreDone === 0 && childRows.some((r) => r.category === "chore")) weakCategories.push("chores");

    const subjectNeeds: string[] = [];
    if (mathDone === 0) subjectNeeds.push("math");
    if (readingDone === 0) subjectNeeds.push("reading");
    if (scienceDone === 0) subjectNeeds.push("science");

    const focusAreas =
      weakCategories.length > 0 || subjectNeeds.length > 0
        ? `Needs improvement: ${[...weakCategories, ...subjectNeeds].join(", ")}.`
        : "Strengths: balanced completion across categories and subjects.";

    let nextBestStep = "Next best step: keep one task per category active (learning, exercise, chore).";
    let recommendation = `${c.name ?? "Child"} is showing steady progress.`;

    if ((c.daily_limit_minutes ?? 0) >= 720) {
      recommendation = `${c.name ?? "Child"} has a high daily screen limit (${screenLimitHours}h). Consider lowering it gradually.`;
      nextBestStep = "Next best step: reduce daily screen limit by 30–60 minutes and monitor for 3 days.";
    }
    if (completed7.length === 0) {
      nextBestStep = "Next best step: assign 1 easy learning game and 1 short exercise for tomorrow.";
      recommendation = `${c.name ?? "Child"} has no recent completions. Start with low-friction wins.`;
    } else if (mathDone === 0 && learningDone > 0) {
      nextBestStep = "Next best step: assign 1–2 math-focused games in the next 24 hours.";
      recommendation = "Learning activity is present, but math progress is low this week.";
    } else if (exerciseDone === 0) {
      nextBestStep = "Next best step: assign a 5-minute exercise session daily for 3 days.";
      recommendation = "Physical activity is missing this week.";
    } else if (activeCount >= 6) {
      nextBestStep = "Next best step: reduce active tasks to 3–5 and prioritize today's top 2.";
      recommendation = "The queue looks overloaded; fewer tasks may improve quality.";
    }

    return {
      childId: c.id,
      childName: c.name ?? "Child",
      summary,
      latestTaskLine,
      focusAreas,
      nextBestStep,
      recommendation,
    };
  });
}

export function ParentOverviewScreen() {
  const { isSupabaseConfigured } = useAuth();
  const [stats, setStats] = useState<ParentStat[]>([]);
  const [analytics, setAnalytics] = useState<ParentDashboardAnalytics | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [insights, setInsights] = useState<ChildInsight[]>([]);
  const [insightsMenuVisible, setInsightsMenuVisible] = useState(false);
  const [selectedInsightChildId, setSelectedInsightChildId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pushTokenReady, setPushTokenReady] = useState<boolean | null>(null);
  const [pushRegistering, setPushRegistering] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void hasMyPushToken().then((ok) => {
        if (active) setPushTokenReady(ok);
      });
      return () => {
        active = false;
      };
    }, [])
  );

  const loadDashboard = useCallback(async (fromPull = false) => {
    if (!isSupabaseConfigured || !supabase) {
      setStats([
        { label: "Children Managed", value: "0" },
        { label: "Active Now", value: "0" },
        { label: "Pending Reviews", value: "0" },
        { label: "Completed This Week", value: "0" },
      ]);
      setAnalytics(null);
      setActivity([]);
      setInsights([]);
      setIsLoading(false);
      setRefreshing(false);
      return;
    }

    if (fromPull) setRefreshing(true);
    else setIsLoading(true);
    setError(null);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError(formatAppError(userError ?? new Error("Not signed in.")));
      setIsLoading(false);
      setRefreshing(false);
      return;
    }

    const { data: children, error: childrenError } = await supabase
      .from("children")
      .select(
        "id, name, stars, daily_limit_minutes, difficulty_level, is_online, last_seen_at, child_user_id"
      )
      .eq("parent_id", user.id);

    if (childrenError || !children) {
      setError(formatAppError(childrenError ?? new Error("Failed to load children.")));
      setIsLoading(false);
      setRefreshing(false);
      return;
    }

    const childRows = children as ChildRow[];
    const childIds = childRows.map((c) => c.id);
    let taskRows: TaskRow[] = [];
    let recentActivity: ActivityItem[] = [];
    let pendingReviewsByChild: Record<string, number> = {};
    let activityPointsThisWeek = 0;

    if (childIds.length > 0) {
      const weekStartIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [tasksRes, logsRes, subsRes, pointsRes] = await Promise.all([
        supabase
          .from("tasks")
          .select("child_id, title, category, status, created_at, completed_at")
          .in("child_id", childIds)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("activity_logs")
          .select("id, type, points, metadata, created_at")
          .in("child_id", childIds)
          .order("created_at", { ascending: false })
          .limit(12),
        supabase.from("task_submissions").select("child_id").eq("status", "submitted"),
        supabase
          .from("activity_logs")
          .select("points")
          .in("child_id", childIds)
          .gte("created_at", weekStartIso),
      ]);

      if (tasksRes.error) {
        setError(formatAppError(tasksRes.error));
        setIsLoading(false);
        setRefreshing(false);
        return;
      }
      if (logsRes.error) {
        setError(formatAppError(logsRes.error));
        setIsLoading(false);
        setRefreshing(false);
        return;
      }

      taskRows = (tasksRes.data as TaskRow[]) ?? [];
      recentActivity = (logsRes.data as ActivityItem[]) ?? [];

      for (const row of subsRes.data ?? []) {
        const cid = (row as { child_id: string }).child_id;
        pendingReviewsByChild[cid] = (pendingReviewsByChild[cid] ?? 0) + 1;
      }

      activityPointsThisWeek = (pointsRes.data ?? []).reduce(
        (sum, row) => sum + ((row as { points: number }).points ?? 0),
        0
      );
    }

    const built = buildParentDashboardAnalytics({
      children: childRows,
      tasks: taskRows,
      pendingReviewsByChild,
      activityPointsThisWeek,
    });

    const nextInsights = buildInsights(childRows, taskRows);

    setAnalytics(built);
    setStats([
      { label: "Children Managed", value: String(childRows.length) },
      {
        label: "Active Now",
        value: childRows.length ? `${built.onlineCount}/${childRows.length}` : "0",
      },
      { label: "Pending Reviews", value: String(built.pendingReviewsTotal) },
      { label: "Completed This Week", value: String(built.week.totalCompleted) },
    ]);
    setActivity(recentActivity);
    setInsights(nextInsights);
    setSelectedInsightChildId((prev) =>
      prev && nextInsights.some((i) => i.childId === prev) ? prev : nextInsights[0]?.childId ?? null
    );
    setIsLoading(false);
    setRefreshing(false);
  }, [isSupabaseConfigured]);

  useEffect(() => {
    void loadDashboard(false);
  }, [loadDashboard]);

  const onRefresh = useCallback(() => {
    void loadDashboard(true);
  }, [loadDashboard]);

  const selectedInsight = useMemo(
    () => insights.find((i) => i.childId === selectedInsightChildId) ?? insights[0] ?? null,
    [insights, selectedInsightChildId]
  );

  return (
    <ScreenContainer scroll onRefresh={onRefresh} refreshing={refreshing}>
      <Text variant="titleMedium" style={styles.kicker}>
        Overview
      </Text>
      <Text variant="bodyMedium" style={styles.subKicker}>
        Monitoring & analytics for your family
      </Text>

      {isLoading && !refreshing ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {pushTokenReady === false ? (
        <Card style={styles.pushBanner}>
          <Card.Content>
            <Text variant="titleSmall">Alerts not enabled on this device</Text>
            <Text variant="bodySmall" style={styles.pushBannerHint}>
              Parent notifications (task completed, submissions) need a push token saved for your account. Use a
              separate phone/emulator from the child account.
            </Text>
            <Button
              mode="contained"
              loading={pushRegistering}
              disabled={pushRegistering}
              style={styles.pushBannerBtn}
              onPress={async () => {
                setPushRegistering(true);
                try {
                  const result = await registerAndSavePushToken();
                  setPushTokenReady(result.ok);
                  if (!result.ok) {
                    setError(result.message);
                  }
                } finally {
                  setPushRegistering(false);
                }
              }}
            >
              Enable alerts on this device
            </Button>
          </Card.Content>
        </Card>
      ) : null}

      <View style={styles.grid}>
        {stats.map((item) => {
          const meta = STAT_ICONS[item.label];
          return (
            <View key={item.label} style={styles.gridItem}>
              <StatCard
                label={item.label}
                value={item.value}
                iconName={meta?.icon ?? "chart-box-outline"}
                iconColor={meta?.color ?? colors.primary}
              />
            </View>
          );
        })}
      </View>

      {analytics && analytics.monitors.length > 0 ? (
        <Card style={styles.sectionCard}>
          <Card.Title
            title="Live monitoring"
            subtitle="Presence, tasks, and reviews per child"
            titleStyle={styles.cardTitle}
            left={() => <MaterialCommunityIcons name="monitor-dashboard" size={24} color={colors.primary} />}
          />
          <Card.Content>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monitorScroll}>
              {analytics.monitors.map((m) => (
                <ChildMonitorCard key={m.childId} monitor={m} />
              ))}
            </ScrollView>
          </Card.Content>
        </Card>
      ) : null}

      {analytics ? (
        <Card style={styles.sectionCard}>
          <Card.Title
            title="Task pipeline"
            subtitle="All children — current workload"
            titleStyle={styles.cardTitle}
            left={() => <MaterialCommunityIcons name="transit-connection-variant" size={24} color={colors.info} />}
          />
          <Card.Content>
            <TaskPipelineCard pipeline={analytics.pipeline} />
          </Card.Content>
        </Card>
      ) : null}

      {analytics ? (
        <Card style={styles.sectionCard}>
          <Card.Title
            title="Weekly analytics"
            subtitle={analytics.week.trendLabel}
            titleStyle={styles.cardTitle}
            left={() => <MaterialCommunityIcons name="chart-bar" size={24} color={colors.warning} />}
          />
          <Card.Content style={styles.weekContent}>
            <View style={styles.weekHighlightRow}>
              <View style={styles.weekHighlight}>
                <Text variant="headlineMedium" style={styles.weekNumber}>
                  {analytics.week.totalCompleted}
                </Text>
                <Text variant="labelMedium" style={styles.weekLabel}>
                  Completions (7d)
                </Text>
              </View>
              <View style={styles.weekHighlight}>
                <Text variant="headlineMedium" style={[styles.weekNumber, { color: colors.warning }]}>
                  {analytics.week.pointsThisWeek}
                </Text>
                <Text variant="labelMedium" style={styles.weekLabel}>
                  Activity points
                </Text>
              </View>
            </View>
            <Text variant="titleSmall" style={styles.chartHeading}>
              By category
            </Text>
            <CategoryBarChart
              learning={analytics.week.byCategory.learning}
              exercise={analytics.week.byCategory.exercise}
              chore={analytics.week.byCategory.chore}
            />
          </Card.Content>
        </Card>
      ) : null}

      <Card style={styles.sectionCard}>
        <Card.Title title="Recent activity" titleStyle={styles.cardTitle} />
        <Card.Content style={styles.activityList}>
          {activity.length === 0 ? (
            <Text style={styles.emptyText}>
              No recent activity yet. Complete tasks or review chores to see updates here.
            </Text>
          ) : (
            activity.map((item) => (
              <View key={item.id} style={styles.activityRow}>
                <MaterialCommunityIcons
                  name={ACTIVITY_ICONS[item.type] ?? "history"}
                  size={22}
                  color={colors.primary}
                />
                <View style={styles.activityText}>
                  <Text variant="bodyMedium" style={styles.activityMain}>
                    {item.type.replace(/_/g, " ")}
                    {item.points ? `  +${item.points}` : ""}
                  </Text>
                  <Text variant="labelSmall" style={styles.activityTime}>
                    {formatActivityTime(item.created_at)}
                  </Text>
                </View>
                {item.points > 0 ? (
                  <MaterialCommunityIcons name="star" size={18} color={colors.warning} />
                ) : null}
              </View>
            ))
          )}
        </Card.Content>
      </Card>

      <Card style={styles.sectionCard}>
        <Card.Title title="AI-assisted insights" titleStyle={styles.cardTitle} />
        <Card.Content style={styles.activityList}>
          {insights.length === 0 ? (
            <Text style={styles.emptyText}>Complete a few child tasks to unlock recommendations.</Text>
          ) : (
            <>
              <Menu
                visible={insightsMenuVisible}
                onDismiss={() => setInsightsMenuVisible(false)}
                anchor={
                  <Pressable
                    onPress={() => setInsightsMenuVisible(true)}
                    style={styles.pickerRow}
                    accessibilityRole="button"
                    accessibilityLabel="Select child for insights"
                  >
                    <View style={styles.pickerLeft}>
                      <MaterialCommunityIcons name="account-child-outline" size={20} color={colors.primaryDark} />
                      <View style={styles.pickerTextWrap}>
                        <Text variant="labelMedium" style={styles.pickerLabel}>
                          Child
                        </Text>
                        <Text variant="titleSmall" style={styles.pickerValue}>
                          {selectedInsight?.childName ?? "Select child"}
                        </Text>
                      </View>
                    </View>
                    <MaterialCommunityIcons name="chevron-down" size={22} color={colors.subtext} />
                  </Pressable>
                }
              >
                {insights.map((insight) => (
                  <Menu.Item
                    key={insight.childId}
                    title={insight.childName}
                    onPress={() => {
                      setSelectedInsightChildId(insight.childId);
                      setInsightsMenuVisible(false);
                    }}
                  />
                ))}
              </Menu>

              {selectedInsight ? (
                <View style={styles.insightRow}>
                  <Text variant="bodySmall" style={styles.insightSummary}>
                    {selectedInsight.summary}
                  </Text>
                  <Text variant="bodySmall" style={styles.insightSummary}>
                    {selectedInsight.latestTaskLine}
                  </Text>
                  <Text variant="bodySmall" style={styles.insightFocus}>
                    {selectedInsight.focusAreas}
                  </Text>
                  <Text variant="bodyMedium" style={styles.insightRecommendation}>
                    {selectedInsight.recommendation}
                  </Text>
                  <Text variant="bodyMedium" style={styles.insightStep}>
                    {selectedInsight.nextBestStep}
                  </Text>
                </View>
              ) : null}
            </>
          )}
          <Text style={styles.aiNote}>Recommendations are generated from recent in-app behavior patterns.</Text>
        </Card.Content>
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  kicker: {
    color: colors.subtext,
    marginBottom: 2,
  },
  subKicker: {
    color: colors.subtext,
    marginBottom: 12,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 4,
  },
  gridItem: {
    width: "48%",
  },
  sectionCard: {
    borderRadius: radii.md,
    marginTop: 12,
    ...shadows.card,
  },
  cardTitle: {
    fontWeight: "700",
    color: colors.text,
  },
  monitorScroll: {
    gap: 10,
    paddingVertical: 4,
  },
  weekContent: {
    gap: 16,
  },
  weekHighlightRow: {
    flexDirection: "row",
    gap: 12,
  },
  weekHighlight: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: radii.md,
    padding: 14,
    alignItems: "center",
  },
  weekNumber: {
    fontWeight: "800",
    color: colors.primaryDark,
  },
  weekLabel: {
    color: colors.subtext,
    marginTop: 4,
  },
  chartHeading: {
    color: colors.text,
    fontWeight: "700",
  },
  activityList: {
    gap: 10,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F3F4F6",
    borderRadius: radii.sm,
    padding: 12,
  },
  insightRow: {
    backgroundColor: "#F8FAFC",
    borderRadius: radii.sm,
    padding: 12,
    gap: 4,
  },
  pickerRow: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  pickerTextWrap: {
    flex: 1,
  },
  pickerLabel: {
    color: colors.subtext,
  },
  pickerValue: {
    color: colors.text,
    fontWeight: "700",
  },
  insightSummary: {
    color: colors.subtext,
  },
  insightRecommendation: {
    color: colors.text,
  },
  insightFocus: {
    color: "#7C3AED",
    fontWeight: "600",
  },
  insightStep: {
    color: colors.primaryDark,
    fontWeight: "700",
  },
  aiNote: {
    color: colors.subtext,
    fontStyle: "italic",
  },
  activityText: {
    flex: 1,
  },
  activityMain: {
    color: colors.text,
    textTransform: "capitalize",
  },
  activityTime: {
    color: colors.subtext,
    marginTop: 2,
  },
  emptyText: {
    color: colors.subtext,
    lineHeight: 20,
  },
  errorText: {
    color: "#B91C1C",
  },
  pushBanner: {
    marginBottom: 12,
    borderColor: colors.warning,
    backgroundColor: "#FFFBEB",
  },
  pushBannerHint: {
    color: colors.subtext,
    marginVertical: 8,
  },
  pushBannerBtn: {
    marginTop: 4,
  },
});
