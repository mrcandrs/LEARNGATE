import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ActivityIndicator, Avatar, Card, Chip, Snackbar, Text } from "react-native-paper";
import { AchievementBadgeCard } from "@/components/AchievementBadgeCard";
import { ScreenContainer } from "@/components/ScreenContainer";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ChildDashboardHeader } from "@/components/ChildDashboardHeader";
import { colors, radii, shadows } from "@/theme/theme";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/store/AuthContext";
import { useChildAchievements } from "@/hooks/useChildAchievements";
import { useChildProfile } from "@/hooks/useChildProfile";
import { formatAppError } from "@/utils/errors";
import { pickChildAvatarFromLibrary, uploadChildAvatar } from "@/services/childAvatar";
import type { ChildProfileStackParamList } from "@/types/navigation";
import { levelToDifficultyLabel } from "@/utils/difficulty";

type PointsHistoryItem = {
  id: string;
  type: string;
  points: number;
  created_at: string;
};
type PointsFilter = "all" | "games" | "tasks" | "chores" | "exercise";

export function ChildProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ChildProfileStackParamList, "MyStuffMain">>();
  const { isSupabaseConfigured } = useAuth();
  const { child, loading: profileLoading, error: profileError, refresh: refreshProfile } = useChildProfile();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [pointsHistory, setPointsHistory] = useState<PointsHistoryItem[]>([]);
  const [pointsFilter, setPointsFilter] = useState<PointsFilter>("all");
  const {
    stats: achievementStats,
    progress: achievementProgress,
    unlockedCount,
    totalCount,
    nextUp,
    loading: achievementsLoading,
    refresh: refreshAchievements,
    newUnlockTitle,
    clearNewUnlock,
  } = useChildAchievements(child);

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

      const { data: pointsRows, error: pointsError } = await supabase
        .from("activity_logs")
        .select("id, type, points, created_at")
        .eq("child_id", child.id)
        .gt("points", 0)
        .order("created_at", { ascending: false })
        .limit(20);
      if (pointsError) {
        setError(formatAppError(pointsError));
        setLoading(false);
        setRefreshing(false);
        return;
      }
      setPointsHistory((pointsRows as PointsHistoryItem[]) ?? []);
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
    void refreshAchievements();
  }, [refreshProfile, loadStats, refreshAchievements]);

  const showError = profileError ?? error;
  const filteredPointsHistory = useMemo(() => {
    if (pointsFilter === "all") {
      return pointsHistory;
    }
    const includeByFilter: Record<Exclude<PointsFilter, "all">, (type: string) => boolean> = {
      games: (type) => type.includes("game"),
      tasks: (type) => type.includes("task"),
      chores: (type) => type.includes("chore"),
      exercise: (type) => type.includes("exercise"),
    };
    return pointsHistory.filter((item) => includeByFilter[pointsFilter](item.type.toLowerCase()));
  }, [pointsFilter, pointsHistory]);

  const handleUploadAvatar = async () => {
    if (!child || !supabase) {
      return;
    }
    setError(null);
    try {
      const localUri = await pickChildAvatarFromLibrary();
      if (!localUri) {
        return;
      }
      setUploadingAvatar(true);
      const publicUrl = await uploadChildAvatar({ childId: child.id, localUri });
      const { error: updateError } = await supabase.from("children").update({ avatar_url: publicUrl }).eq("id", child.id);
      if (updateError) {
        throw updateError;
      }
      await refreshProfile();
    } catch (err) {
      setError(formatAppError(err));
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <ScreenContainer scroll contentPadding={0} includeTopInset={false} onRefresh={onRefresh} refreshing={refreshing}>
      {child ? (
        <ChildDashboardHeader
          name={child.name}
          level={child.difficulty_level}
          stars={child.stars}
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
          <PrimaryButton
            label={uploadingAvatar ? "Uploading..." : "Upload Profile Photo"}
            mode="text"
            onPress={() => void handleUploadAvatar()}
            disabled={uploadingAvatar || !child}
          />
          <Text variant="headlineSmall" style={styles.name}>
            {child?.name ?? "Profile"}
          </Text>
          <Text variant="bodyLarge" style={styles.subtitle}>
            Age {child?.age ?? "—"} · {child ? levelToDifficultyLabel(child.difficulty_level) : "—"}
          </Text>
        </View>
        <PrimaryButton label="Settings" mode="outlined" onPress={() => navigation.navigate("ChildSettings")} />

        <Card style={styles.card}>
          <Card.Title title="Learning Stats" titleStyle={styles.cardTitle} />
          <Card.Content style={styles.statsList}>
            {loading && !refreshing ? <ActivityIndicator size="small" color={colors.primary} /> : null}
            <StatRow label="Active days (14d)" value={String(achievementStats?.activeDaysLast14 ?? 0)} />
            <StatRow label="Tasks Completed" value={String(achievementStats?.completedTasks ?? 0)} />
            <StatRow label="Games Finished" value={String(achievementStats?.gamesCompleted ?? 0)} />
            <StatRow label="Daily streak" value={`${achievementStats?.dailyStreak ?? 0} days`} />
            <StatRow label="Stars Earned" value={String(child?.stars ?? 0)} />
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Title
            title="Achievements"
            subtitle={`${unlockedCount} of ${totalCount} unlocked`}
            titleStyle={styles.cardTitle}
          />
          <Card.Content style={styles.badgeGrid}>
            {achievementsLoading && !refreshing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : null}
            {nextUp && !nextUp.unlocked ? (
              <Text style={styles.nextUp}>
                Next up: {nextUp.definition.title} ({nextUp.progress?.current ?? 0}/
                {nextUp.progress?.target ?? "?"})
              </Text>
            ) : null}
            {achievementProgress.map((item) => (
              <AchievementBadgeCard key={item.definition.id} item={item} />
            ))}
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Title title="Points History" titleStyle={styles.cardTitle} />
          <Card.Content style={styles.statsList}>
            <View style={styles.filterRow}>
              <Chip selected={pointsFilter === "all"} onPress={() => setPointsFilter("all")}>
                All
              </Chip>
              <Chip selected={pointsFilter === "games"} onPress={() => setPointsFilter("games")}>
                Games
              </Chip>
              <Chip selected={pointsFilter === "tasks"} onPress={() => setPointsFilter("tasks")}>
                Tasks
              </Chip>
              <Chip selected={pointsFilter === "chores"} onPress={() => setPointsFilter("chores")}>
                Chores
              </Chip>
              <Chip selected={pointsFilter === "exercise"} onPress={() => setPointsFilter("exercise")}>
                Exercise
              </Chip>
            </View>
            {filteredPointsHistory.length === 0 ? (
              <Text style={styles.emptyAch}>No points history yet. Complete tasks and games to earn points.</Text>
            ) : (
              filteredPointsHistory.slice(0, 8).map((item) => (
                <View key={item.id} style={styles.pointsRow}>
                  <View style={styles.pointsText}>
                    <Text variant="bodyMedium" style={styles.pointsType}>
                      {item.type.replace(/_/g, " ")}
                    </Text>
                    <Text variant="bodySmall" style={styles.pointsTime}>
                      {new Date(item.created_at).toLocaleString()}
                    </Text>
                  </View>
                  <Text variant="titleSmall" style={styles.pointsValue}>
                    +{item.points}
                  </Text>
                </View>
              ))
            )}
          </Card.Content>
        </Card>
      </View>

      <Snackbar visible={Boolean(newUnlockTitle)} onDismiss={clearNewUnlock} duration={5000}>
        Achievement unlocked: {newUnlockTitle}
      </Snackbar>
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
  filterChip: {
    backgroundColor: "#F3F4F6",
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
  nextUp: {
    width: "100%",
    color: colors.primaryDark,
    fontWeight: "600",
    marginBottom: 4,
  },
  emptyAch: {
    color: colors.subtext,
  },
  pointsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderRadius: radii.sm,
    padding: 10,
    gap: 10,
  },
  pointsText: {
    flex: 1,
  },
  pointsType: {
    color: colors.text,
    textTransform: "capitalize",
  },
  pointsTime: {
    color: colors.subtext,
  },
  pointsValue: {
    color: colors.primaryDark,
    fontWeight: "800",
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  errorText: {
    color: "#B91C1C",
  },
});
