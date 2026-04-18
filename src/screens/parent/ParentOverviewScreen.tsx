import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Card, Text } from "react-native-paper";
import { ScreenContainer } from "@/components/ScreenContainer";
import { StatCard } from "@/components/StatCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAuth } from "@/store/AuthContext";
import { colors } from "@/theme/theme";
import { ParentStat } from "@/types/app";
import { supabase } from "@/services/supabase";

type ActivityItem = {
  id: string;
  type: string;
  points: number;
  metadata: Record<string, unknown>;
};

export function ParentOverviewScreen() {
  const { signOut, isSupabaseConfigured } = useAuth();
  const [stats, setStats] = useState<ParentStat[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setStats([
        { label: "Children Managed", value: "0" },
        { label: "Tasks Completed", value: "0" },
        { label: "Stars Earned", value: "0" },
        { label: "Avg Daily Limit", value: "0m" },
      ]);
      setActivity([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError("Failed to resolve signed-in user.");
      setIsLoading(false);
      return;
    }

    const { data: children, error: childrenError } = await supabase
      .from("children")
      .select("id, stars, daily_limit_minutes")
      .eq("parent_id", user.id);

    if (childrenError || !children) {
      setError(childrenError?.message ?? "Failed to load children.");
      setIsLoading(false);
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
        setError(tasksError.message);
        setIsLoading(false);
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
        setError(logsError.message);
        setIsLoading(false);
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
  }, [isSupabaseConfigured]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  return (
    <ScreenContainer scroll>
      <Text variant="headlineMedium" style={styles.title}>
        Parent Dashboard
      </Text>

      {isLoading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.grid}>
        {stats.map((item) => (
          <View key={item.label} style={styles.gridItem}>
            <StatCard label={item.label} value={item.value} />
          </View>
        ))}
      </View>

      <Card>
        <Card.Title title="Recent Activity" />
        <Card.Content style={styles.activityList}>
          {activity.length === 0 ? (
            <Text>No recent activity yet.</Text>
          ) : (
            activity.map((item) => (
              <Text key={item.id}>
                {item.type}
                {item.points ? ` (+${item.points})` : ""}
              </Text>
            ))
          )}
        </Card.Content>
      </Card>

      <PrimaryButton label="Refresh Dashboard" onPress={() => void loadDashboard()} mode="text" />
      <PrimaryButton label="Sign Out" onPress={() => void signOut()} mode="outlined" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontWeight: "700",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  gridItem: {
    width: "48%",
  },
  activityList: {
    gap: 8,
  },
  errorText: {
    color: "#B91C1C",
  },
});
