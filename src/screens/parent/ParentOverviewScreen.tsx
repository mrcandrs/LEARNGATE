import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Card, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { StatCard } from "@/components/StatCard";
import { PrimaryButton } from "@/components/PrimaryButton";
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

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

const STAT_ICONS: Record<string, { icon: IconName; color: string }> = {
  "Children Managed": { icon: "account-group-outline", color: colors.primary },
  "Tasks Completed": { icon: "check-circle-outline", color: colors.warning },
  "Stars Earned": { icon: "star-outline", color: colors.warning },
  "Avg Daily Limit": { icon: "lock-clock", color: colors.info },
};

export function ParentOverviewScreen() {
  const { signOut, isSupabaseConfigured } = useAuth();
  const [stats, setStats] = useState<ParentStat[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
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
      .select("id, stars, daily_limit_minutes")
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
    }

    setStats([
      { label: "Children Managed", value: String(children.length) },
      { label: "Tasks Completed", value: String(completedTasks) },
      { label: "Stars Earned", value: String(totalStars) },
      { label: "Avg Daily Limit", value: `${avgDailyLimit}m` },
    ]);
    setActivity(recentActivity);
    setIsLoading(false);
    setRefreshing(false);
  }, [isSupabaseConfigured]);

  useEffect(() => {
    void loadDashboard(false);
  }, [loadDashboard]);

  const onRefresh = useCallback(() => {
    void loadDashboard(true);
  }, [loadDashboard]);

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

      <PrimaryButton label="Refresh" onPress={() => void loadDashboard(false)} mode="text" />
      <PrimaryButton label="Sign Out" onPress={() => void signOut()} mode="outlined" />
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
