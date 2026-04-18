import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentProps } from "react";
import { Image, StyleSheet, View } from "react-native";
import { ActivityIndicator, Avatar, Card, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ChildDashboardHeader } from "@/components/ChildDashboardHeader";
import { colors, radii, shadows } from "@/theme/theme";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/store/AuthContext";
import { useChildProfile } from "@/hooks/useChildProfile";
import { formatAppError } from "@/utils/errors";

export function ChildProfileScreen() {
  const { isSupabaseConfigured, signOut } = useAuth();
  const { child, loading: profileLoading, error: profileError, refresh: refreshProfile } = useChildProfile();
  const [completedTasks, setCompletedTasks] = useState(0);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(
    async (fromPull = false) => {
      if (!isSupabaseConfigured || !supabase || !child) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (fromPull) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const { count, error: tasksCountError } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("child_id", child.id)
        .eq("status", "completed");
      if (tasksCountError) {
        setError(formatAppError(tasksCountError));
        setLoading(false);
        setRefreshing(false);
        return;
      }
      setCompletedTasks(count ?? 0);

      const { count: activityCount } = await supabase
        .from("activity_logs")
        .select("id", { count: "exact", head: true })
        .eq("child_id", child.id)
        .eq("type", "game_played");
      setGamesPlayed(activityCount ?? 0);
      setLoading(false);
      setRefreshing(false);
    },
    [isSupabaseConfigured, child]
  );

  useEffect(() => {
    if (child) {
      void loadStats(false);
    } else if (!profileLoading) {
      setLoading(false);
    }
  }, [child, profileLoading, loadStats]);

  const onRefresh = useCallback(() => {
    void refreshProfile();
    void loadStats(true);
  }, [refreshProfile, loadStats]);

  const achievements = useMemo(() => {
    type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];
    const badges: { icon: IconName; label: string }[] = [];
    if ((child?.stars ?? 0) > 0) {
      badges.push({ icon: "star", label: "First Star" });
    }
    if ((child?.stars ?? 0) >= 200) {
      badges.push({ icon: "star-circle", label: "Star Collector" });
    }
    if (completedTasks >= 10) {
      badges.push({ icon: "trophy", label: "Task Finisher" });
    }
    if (completedTasks >= 50) {
      badges.push({ icon: "book-open-page-variant", label: "Learning Champ" });
    }
    return badges;
  }, [completedTasks, child?.stars]);

  const showError = profileError ?? error;

  return (
    <ScreenContainer scroll contentPadding={0} onRefresh={onRefresh} refreshing={refreshing}>
      {child ? (
        <ChildDashboardHeader
          name={child.name}
          level={child.difficulty_level}
          stars={child.stars}
          dailyLimitMinutes={child.daily_limit_minutes}
          avatarUrl={child.avatar_url}
        />
      ) : null}

      <View style={styles.pad}>
        {profileLoading && !refreshing ? <ActivityIndicator size="small" color={colors.primary} /> : null}
        {showError ? <Text style={styles.errorText}>{showError}</Text> : null}

        <View style={styles.identity}>
          {child?.avatar_url ? (
            <Image source={{ uri: child.avatar_url }} style={styles.bigAvatar} />
          ) : (
            <Avatar.Icon size={120} icon="account" style={styles.bigAvatarPlaceholder} color={colors.primary} />
          )}
          <Text variant="headlineSmall" style={styles.name}>
            {child?.name ?? "Profile"}
          </Text>
          <Text variant="bodyLarge" style={styles.subtitle}>
            Age {child?.age ?? "—"} · Level {child?.difficulty_level ?? "—"}
          </Text>
        </View>

        <Card style={styles.card}>
          <Card.Title title="Learning Stats" titleStyle={styles.cardTitle} />
          <Card.Content style={styles.statsList}>
            {loading && !refreshing ? <ActivityIndicator size="small" color={colors.primary} /> : null}
            <StatRow label="Total Learning Time" value="—" />
            <StatRow label="Tasks Completed" value={String(completedTasks)} />
            <StatRow label="Games Played" value={String(gamesPlayed)} />
            <StatRow label="Stars Earned" value={String(child?.stars ?? 0)} />
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Title title="Achievements" titleStyle={styles.cardTitle} />
          <Card.Content style={styles.badgeGrid}>
            {achievements.length === 0 ? (
              <Text style={styles.emptyAch}>Complete tasks to unlock achievements.</Text>
            ) : (
              achievements.map((b) => (
                <View key={b.label} style={styles.badge}>
                  <MaterialCommunityIcons name={b.icon} size={22} color={colors.primary} />
                  <Text variant="labelSmall" style={styles.badgeLabel}>
                    {b.label}
                  </Text>
                </View>
              ))
            )}
          </Card.Content>
        </Card>

        <PrimaryButton label="Sign Out" onPress={() => void signOut()} mode="outlined" />
      </View>
    </ScreenContainer>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  identity: {
    alignItems: "center",
    marginBottom: 8,
  },
  bigAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.border,
  },
  bigAvatarPlaceholder: {
    backgroundColor: colors.background,
  },
  name: {
    fontWeight: "700",
    color: colors.text,
    marginTop: 12,
  },
  subtitle: {
    color: colors.subtext,
    marginTop: 4,
  },
  card: {
    borderRadius: radii.md,
    ...shadows.card,
  },
  cardTitle: {
    fontWeight: "700",
    color: colors.text,
  },
  statsList: {
    gap: 12,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statLabel: {
    color: colors.subtext,
    flex: 1,
  },
  statValue: {
    color: colors.text,
    fontWeight: "700",
  },
  badgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  badge: {
    width: "47%",
    backgroundColor: "#F3F4F6",
    borderRadius: radii.sm,
    padding: 12,
    alignItems: "center",
    gap: 6,
  },
  badgeLabel: {
    textAlign: "center",
    color: colors.text,
  },
  emptyAch: {
    color: colors.subtext,
  },
  errorText: {
    color: "#B91C1C",
  },
});
