import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ActivityIndicator, Card, Menu, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { StatCard } from "@/components/StatCard";
import { useAuth } from "@/store/AuthContext";
import { colors, radii, shadows } from "@/theme/theme";
import { ParentStat } from "@/types/app";
import { supabase } from "@/services/supabase";
import { formatAppError } from "@/utils/errors";
import type { ComponentProps } from "react";

type ActivityItem = {
  id: string;
  type: string;
  points: number;
  metadata: Record<string, unknown>;
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
  "Tasks Completed": { icon: "check-circle-outline", color: colors.warning },
  "Stars Earned": { icon: "star-outline", color: colors.warning },
  "Avg Daily Limit": { icon: "lock-clock", color: colors.info },
};

export function ParentOverviewScreen() {
  const { isSupabaseConfigured } = useAuth();
  const [stats, setStats] = useState<ParentStat[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [insights, setInsights] = useState<ChildInsight[]>([]);
  const [insightsMenuVisible, setInsightsMenuVisible] = useState(false);
  const [selectedInsightChildId, setSelectedInsightChildId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (fromPull = false) => {
    if (!isSupabaseConfigured || !supabase) {
      setStats([
        { label: "Children Managed", value: "0" },
        { label: "Tasks Completed", value: "0" },
        { label: "Stars Earned", value: "0" },
        { label: "Avg Daily Limit", value: "0m" },
      ]);
      setActivity([]);
      setIsLoading(false);
      setRefreshing(false);
      return;
    }

    if (fromPull) {
      setRefreshing(true);
    } else {
      setIsLoading(true);
    }
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
      .select("id, name, stars, daily_limit_minutes, difficulty_level")
      .eq("parent_id", user.id);

    if (childrenError || !children) {
      setError(formatAppError(childrenError ?? new Error("Failed to load children.")));
      setIsLoading(false);
      setRefreshing(false);
      return;
    }

    const childIds = children.map((c) => c.id);
    const totalStars = children.reduce((sum, c) => sum + (c.stars ?? 0), 0);
    const avgDailyLimit = children.length
      ? Math.round(children.reduce((sum, c) => sum + (c.daily_limit_minutes ?? 0), 0) / children.length)
      : 0;

    let completedTasks = 0;
    let recentActivity: ActivityItem[] = [];
    let nextInsights: ChildInsight[] = [];

    if (childIds.length > 0) {
      const { count, error: tasksError } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .in("child_id", childIds)
        .eq("status", "completed");

      if (tasksError) {
        setError(formatAppError(tasksError));
        setIsLoading(false);
        setRefreshing(false);
        return;
      }
      completedTasks = count ?? 0;

      const { data: logs, error: logsError } = await supabase
        .from("activity_logs")
        .select("id, type, points, metadata")
        .in("child_id", childIds)
        .order("created_at", { ascending: false })
        .limit(10);

      if (logsError) {
        setError(formatAppError(logsError));
        setIsLoading(false);
        setRefreshing(false);
        return;
      }
      recentActivity = (logs as ActivityItem[]) ?? [];

      const { data: taskRows, error: insightsTasksError } = await supabase
        .from("tasks")
        .select("child_id, title, category, status, created_at, completed_at")
        .in("child_id", childIds)
        .order("created_at", { ascending: false })
        .limit(500);

      if (insightsTasksError) {
        setError(formatAppError(insightsTasksError));
        setIsLoading(false);
        setRefreshing(false);
        return;
      }

      const now = Date.now();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const rows =
        ((taskRows as Array<{
          child_id: string;
          title: string;
          category: "learning" | "exercise" | "chore";
          status: string;
          created_at: string;
          completed_at: string | null;
        }>) ?? []);

      nextInsights = children.map((c) => {
        const childRows = rows.filter((r) => r.child_id === c.id);
        const completedRows = childRows.filter((r) => r.status === "completed");
        const completed7 = completedRows.filter((r) => r.completed_at && now - new Date(r.completed_at).getTime() <= sevenDaysMs);
        const activeCount = childRows.filter((r) => r.status !== "completed").length;

        const learningDone = completed7.filter((r) => r.category === "learning").length;
        const exerciseDone = completed7.filter((r) => r.category === "exercise").length;
        const choreDone = completed7.filter((r) => r.category === "chore").length;
        const learningTitles7 = completed7.filter((r) => r.category === "learning").map((r) => r.title.toLowerCase());
        const mathDone = learningTitles7.filter((t) => t.includes("math") || t.includes("number")).length;
        const readingDone = learningTitles7.filter((t) => t.includes("alphabet") || t.includes("read")).length;
        const scienceDone = learningTitles7.filter((t) => t.includes("science")).length;
        const latestCompleted = [...completedRows]
          .sort((a, b) => new Date(b.completed_at ?? b.created_at).getTime() - new Date(a.completed_at ?? a.created_at).getTime())[0];

        const screenLimitHours = Math.round((c.daily_limit_minutes ?? 0) / 60);
        const summary = `${completed7.length} tasks completed this week · ${activeCount} active tasks · screen limit set to ${screenLimitHours}h/day`;
        const latestTaskLine = latestCompleted
          ? `Latest completion: ${latestCompleted.title} (${latestCompleted.category})`
          : "Latest completion: none yet";

        const weakCategories: string[] = [];
        if (learningDone === 0) {
          weakCategories.push("learning");
        }
        if (exerciseDone === 0) {
          weakCategories.push("exercise");
        }
        if (choreDone === 0 && childRows.some((r) => r.category === "chore")) {
          weakCategories.push("chores");
        }
        const subjectNeeds: string[] = [];
        if (mathDone === 0) {
          subjectNeeds.push("math");
        }
        if (readingDone === 0) {
          subjectNeeds.push("reading");
        }
        if (scienceDone === 0) {
          subjectNeeds.push("science");
        }

        const focusAreas =
          weakCategories.length > 0 || subjectNeeds.length > 0
            ? `Needs improvement: ${[...weakCategories, ...subjectNeeds].join(", ")}.`
            : "Strengths: balanced completion across categories and subjects.";

        let nextBestStep = "Next best step: keep one task per category active (learning, exercise, chore).";
        let recommendation = `${c.name ?? "Child"} is showing steady progress.`;
        if ((c.daily_limit_minutes ?? 0) >= 720) {
          recommendation = `${c.name ?? "Child"} has a high daily screen limit (${screenLimitHours}h). Consider lowering it gradually while keeping task completion rewards.`;
          nextBestStep = "Next best step: reduce daily screen limit by 30-60 minutes and monitor completion for 3 days.";
        }
        if (completed7.length === 0) {
          nextBestStep = "Next best step: assign 1 easy learning game and 1 short exercise for tomorrow.";
          recommendation = `${c.name ?? "Child"} has no recent completions. Start with low-friction wins to rebuild momentum.`;
        } else if (mathDone === 0 && learningDone > 0) {
          nextBestStep = "Next best step: assign 1-2 math-focused games (Math Challenge / Number Train) in the next 24 hours.";
          recommendation = "Learning activity is present, but math-focused progress is low this week.";
        } else if (exerciseDone === 0) {
          nextBestStep = "Next best step: assign a 5-minute exercise session daily for the next 3 days.";
          recommendation = "Learning/chore progress exists, but physical activity is missing this week.";
        } else if (activeCount >= 6) {
          nextBestStep = "Next best step: reduce active tasks to 3-5 and prioritize today's top 2 only.";
          recommendation = "The queue appears overloaded; completion quality may improve with fewer active tasks.";
        } else if (learningDone >= 3 && (c.difficulty_level ?? 1) < 10) {
          nextBestStep = "Next best step: increase learning difficulty by +1 and monitor completion for 3 days.";
          recommendation = "Learning consistency is strong and ready for a mild challenge increase.";
        } else if (choreDone === 0 && childRows.some((r) => r.category === "chore")) {
          nextBestStep = "Next best step: split chores into smaller photo-verified steps (1-2 steps each).";
          recommendation = "Chore completion is lagging behind other categories.";
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

    setStats([
      { label: "Children Managed", value: String(children.length) },
      { label: "Tasks Completed", value: String(completedTasks) },
      { label: "Stars Earned", value: String(totalStars) },
      { label: "Avg Daily Limit", value: `${avgDailyLimit}m` },
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

      {isLoading && !refreshing ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

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

      <Card style={styles.activityCard}>
        <Card.Title title="Recent Activity" titleStyle={styles.cardTitle} />
        <Card.Content style={styles.activityList}>
          {activity.length === 0 ? (
            <Text style={styles.emptyText}>No recent activity yet. Complete tasks or review chores to see updates here.</Text>
          ) : (
            activity.map((item) => (
              <View key={item.id} style={styles.activityRow}>
                <MaterialCommunityIcons name="school-outline" size={22} color={colors.primary} />
                <View style={styles.activityText}>
                  <Text variant="bodyMedium" style={styles.activityMain}>
                    {item.type.replace(/_/g, " ")}
                    {item.points ? `  +${item.points}` : ""}
                  </Text>
                </View>
                <MaterialCommunityIcons name="star" size={18} color={colors.warning} />
              </View>
            ))
          )}
        </Card.Content>
      </Card>

      <Card style={styles.activityCard}>
        <Card.Title title="AI-Assisted Insights" titleStyle={styles.cardTitle} />
        <Card.Content style={styles.activityList}>
          {insights.length === 0 ? (
            <Text style={styles.emptyText}>Complete a few child tasks to unlock analytics recommendations.</Text>
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
    marginBottom: 4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  gridItem: {
    width: "48%",
  },
  activityCard: {
    borderRadius: radii.md,
    ...shadows.card,
  },
  cardTitle: {
    fontWeight: "700",
    color: colors.text,
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
  insightName: {
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
  emptyText: {
    color: colors.subtext,
    lineHeight: 20,
  },
  errorText: {
    color: "#B91C1C",
  },
});
