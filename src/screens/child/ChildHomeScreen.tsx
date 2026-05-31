import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { CompositeNavigationProp, NavigationProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ActivityIndicator, Card, Snackbar, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { AchievementBadgeCard } from "@/components/AchievementBadgeCard";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ChildDashboardHeader } from "@/components/ChildDashboardHeader";
import { radii, shadows } from "@/theme/theme";
import { useAppColors } from "@/theme/useAppColors";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/store/AuthContext";
import { useChildAchievements } from "@/hooks/useChildAchievements";
import { useChildProfile } from "@/hooks/useChildProfile";
import { useChildTaskActions } from "@/hooks/useChildTaskActions";
import { ChorePhotoReviewModal } from "@/components/child/ChorePhotoReviewModal";
import { formatAppError } from "@/utils/errors";
import { CHILD_GAME_CATALOG } from "@/data/childGames";
import type { ChildHomeStackParamList, ChildTabParamList } from "@/types/navigation";
import { taskCategoryIcon, taskCategoryTint, taskSubtitle, type TaskRow } from "@/utils/childTaskDisplay";

type HomeNav = CompositeNavigationProp<
  NativeStackNavigationProp<ChildHomeStackParamList, "HomeMain">,
  NavigationProp<ChildTabParamList>
>;

export function ChildHomeScreen() {
  const navigation = useNavigation<HomeNav>();
  const c = useAppColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const { isSupabaseConfigured } = useAuth();
  const { child, loading: profileLoading, error: profileError, refresh: refreshProfile } = useChildProfile();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    stats: achievementStats,
    progress: achievementProgress,
    unlockedCount,
    totalCount,
    nextUp,
    loading: achievementsLoading,
    refresh: refreshAchievements,
  } = useChildAchievements(child);

  const tabNav = useNavigation<NavigationProp<ChildTabParamList>>();
  const {
    onTaskPress,
    snackbar,
    setSnackbar,
    uploadingTaskId,
    pendingChorePhoto,
    cancelChorePhotoReview,
    retakeChorePhoto,
    submitChorePhoto,
    error: actionError,
  } = useChildTaskActions(tabNav);

  const loadHomeData = useCallback(
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

      const { data: pendingTasks, error: tasksError } = await supabase
        .from("tasks")
        .select("id, title, category, xp_reward, status, requires_camera, description")
        .eq("child_id", child.id)
        .in("status", ["pending", "in_progress", "submitted"])
        .order("created_at", { ascending: true })
        .limit(8);

      if (tasksError) {
        setError(formatAppError(tasksError));
        setLoading(false);
        setRefreshing(false);
        return;
      }
      setTasks((pendingTasks as TaskRow[]) ?? []);
      setLoading(false);
      setRefreshing(false);
    },
    [isSupabaseConfigured, child]
  );

  useEffect(() => {
    if (child) {
      void loadHomeData(false);
    } else if (!profileLoading) {
      setLoading(false);
    }
  }, [child, profileLoading, loadHomeData]);

  const onRefresh = useCallback(() => {
    void refreshProfile();
    void loadHomeData(true);
    void refreshAchievements();
  }, [refreshProfile, loadHomeData, refreshAchievements]);

  const streakDays = achievementStats?.dailyStreak ?? 0;
  const showError = profileError ?? error ?? actionError;
  const previewTasks = tasks.slice(0, 4);
  return (
    <ScreenContainer scroll contentPadding={0} includeTopInset={false} onRefresh={onRefresh} refreshing={refreshing}>
      {child ? (
        <ChildDashboardHeader
          name={child.name}
          level={child.difficulty_level}
          stars={child.stars}
          avatarUrl={child.avatar_url}
          onAvatarPress={() => navigation.navigate("ProfileSettings")}
        />
      ) : null}

      <View style={styles.pad}>
        {profileLoading && !refreshing ? <ActivityIndicator size="small" color={c.primary} /> : null}
        {showError ? <Text style={styles.errorText}>{showError}</Text> : null}

        <LinearGradient colors={["#FF9800", "#FFB74D", "#FFC107"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.streakCard}>
          <MaterialCommunityIcons name="fire" size={36} color="#FFFFFF" />
          <View style={styles.streakText}>
            <Text variant="titleMedium" style={styles.streakTitle}>
              {streakDays > 0 ? `${streakDays}-day streak!` : "Start your streak"}
            </Text>
            <Text variant="bodySmall" style={styles.streakSub}>
              {streakDays > 0
                ? `Keep it going — ${unlockedCount}/${totalCount} achievements unlocked.`
                : nextUp
                  ? `Complete a task today — next badge: ${nextUp.definition.title}.`
                  : "Complete a task or game today to begin your streak."}
            </Text>
          </View>
          <View style={styles.streakBadge}>
            <Text style={styles.streakBadgeText}>{streakDays}</Text>
          </View>
        </LinearGradient>

        <View style={styles.sectionHeader}>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            Today&apos;s Task
          </Text>
          <Pressable onPress={() => navigation.navigate("TasksList")} accessibilityRole="button">
            <Text style={styles.seeAll}>View all ›</Text>
          </Pressable>
        </View>

        {loading && !refreshing ? <ActivityIndicator size="small" color={c.primary} /> : null}
        {!loading && previewTasks.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Text style={styles.emptyText}>No pending tasks yet. You&apos;re all caught up!</Text>
            </Card.Content>
          </Card>
        ) : (
          previewTasks.map((task) => (
            <Pressable
              key={task.id}
              onPress={() => onTaskPress(task, () => void loadHomeData(false))}
              accessibilityRole="button"
              disabled={uploadingTaskId === task.id}
            >
              <Card style={styles.taskCard}>
                <Card.Content style={styles.taskRow}>
                  <View style={[styles.taskIconWrap, { backgroundColor: taskCategoryTint(task.category, c) }]}>
                    <MaterialCommunityIcons name={taskCategoryIcon(task.category)} size={22} color={c.primaryDark} />
                  </View>
                  <View style={styles.taskText}>
                    <Text variant="titleSmall" style={styles.taskTitle} numberOfLines={1}>
                      {task.title}
                    </Text>
                    <Text variant="bodySmall" style={styles.taskMeta}>
                      {taskSubtitle(task)}
                    </Text>
                  </View>
                  {uploadingTaskId === task.id ? (
                    <ActivityIndicator size="small" color={c.primary} />
                  ) : (
                    <Text style={styles.taskReward}>+{task.xp_reward}</Text>
                  )}
                </Card.Content>
              </Card>
            </Pressable>
          ))
        )}

        <View style={[styles.sectionHeader, { marginTop: 8 }]}>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            Recommended Games
          </Text>
          <Pressable
            onPress={() => navigation.navigate("Activities", { screen: "ActivitiesMain", params: { segment: "games" } })}
            accessibilityRole="button"
          >
            <Text style={styles.seeAll}>See all ›</Text>
          </Pressable>
        </View>

        <View style={styles.gameRow}>
          {CHILD_GAME_CATALOG.slice(0, 2).map((game) => (
            <Pressable
              key={game.id}
              accessibilityRole="button"
              style={({ pressed }) => [styles.gameMiniWrap, styles.gameMiniEqual, pressed && styles.pressed]}
              onPress={() =>
                navigation.navigate("Activities", {
                  screen: "GamePlay",
                  params: { gameId: game.id, title: game.title },
                })
              }
            >
              <View style={[styles.gameMini, { backgroundColor: game.color }]}>
                <View style={styles.gameMiniTop}>
                  <Text style={styles.gameGlyph}>{game.glyph}</Text>
                  <MaterialCommunityIcons name="play-circle" size={28} color="rgba(255,255,255,0.95)" />
                </View>
                <Text style={styles.gameTitle}>{game.title}</Text>
                <Text style={styles.gameXp}>+50 XP</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <Card style={styles.statsCard}>
          <Card.Title title="Learning Stats" titleStyle={styles.cardTitle} subtitleStyle={{ color: c.subtext }} />
          <Card.Content style={styles.statsList}>
            <StatRow label="Active days (14d)" value={String(achievementStats?.activeDaysLast14 ?? 0)} />
            <StatRow label="Tasks Completed" value={String(achievementStats?.completedTasks ?? 0)} />
            <StatRow label="Games Finished" value={String(achievementStats?.gamesCompleted ?? 0)} />
            <StatRow label="Daily streak" value={`${streakDays} days`} />
            <StatRow label="Stars Earned" value={String(child?.stars ?? 0)} />
          </Card.Content>
        </Card>

        <Card style={styles.statsCard}>
          <Card.Title
            title="Achievements"
            subtitle={`${unlockedCount} of ${totalCount} unlocked`}
            titleStyle={styles.cardTitle}
            subtitleStyle={{ color: c.subtext }}
          />
          <Card.Content>
            {achievementsLoading && !refreshing ? <ActivityIndicator size="small" color={c.primary} /> : null}
            {nextUp && !nextUp.unlocked ? (
              <Text style={styles.nextUp}>
                Next up: {nextUp.definition.title} ({nextUp.progress?.current ?? 0}/{nextUp.progress?.target ?? "?"})
              </Text>
            ) : null}
            <View style={styles.badgeGrid}>
              {achievementProgress.map((item) => (
                <AchievementBadgeCard key={item.definition.id} item={item} />
              ))}
            </View>
          </Card.Content>
        </Card>
      </View>

      <ChorePhotoReviewModal
        visible={Boolean(pendingChorePhoto)}
        photoUri={pendingChorePhoto?.uri ?? null}
        taskTitle={pendingChorePhoto?.task.title ?? "Chore"}
        uploading={Boolean(pendingChorePhoto && uploadingTaskId === pendingChorePhoto.task.id)}
        onCancel={cancelChorePhotoReview}
        onRetake={retakeChorePhoto}
        onSubmit={() => void submitChorePhoto()}
      />

      <Snackbar visible={Boolean(snackbar)} onDismiss={() => setSnackbar(null)} duration={4000}>
        {snackbar ?? ""}
      </Snackbar>
    </ScreenContainer>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  const c = useAppColors();
  return (
    <View style={statStyles.row}>
      <Text style={[statStyles.label, { color: c.subtext }]}>{label}</Text>
      <Text style={[statStyles.value, { color: c.text }]}>{value}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { flex: 1 },
  value: { fontWeight: "700" },
});

function createStyles(c: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    pad: { paddingHorizontal: 16, paddingBottom: 28, gap: 10 },
    streakCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 16,
      borderRadius: radii.md,
      ...shadows.card,
    },
    streakText: { flex: 1 },
    streakTitle: { color: "#FFFFFF", fontWeight: "800" },
    streakSub: { color: "rgba(255,255,255,0.95)", marginTop: 4 },
    streakBadge: {
      backgroundColor: "rgba(255,255,255,0.3)",
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    streakBadgeText: { color: "#FFFFFF", fontWeight: "800", fontSize: 18 },
    sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    sectionTitle: { color: c.text, fontWeight: "700" },
    seeAll: { color: c.primary, fontWeight: "700" },
    taskCard: { backgroundColor: c.card, borderRadius: radii.md, ...shadows.card },
    taskRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    taskIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    taskText: { flex: 1, minWidth: 0 },
    taskTitle: { color: c.text, fontWeight: "700" },
    taskMeta: { color: c.subtext, marginTop: 2 },
    taskReward: { color: c.warning, fontWeight: "800", fontSize: 16 },
    emptyCard: { backgroundColor: c.card, borderRadius: radii.md },
    emptyText: { color: c.subtext },
    gameRow: { flexDirection: "row", gap: 10, alignItems: "stretch" },
    gameMiniWrap: { flex: 1 },
    gameMiniEqual: { minWidth: 0 },
    pressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
    gameMini: {
      flex: 1,
      borderRadius: radii.md,
      padding: 14,
      height: 136,
      justifyContent: "space-between",
      ...shadows.card,
    },
    gameMiniTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    gameGlyph: { color: "#FFFFFF", fontSize: 32, fontWeight: "800" },
    gameTitle: { color: "#FFFFFF", fontWeight: "700", marginTop: 8 },
    gameXp: { color: "rgba(255,255,255,0.9)", marginTop: 4 },
    statsCard: { backgroundColor: c.card, borderRadius: radii.md, marginTop: 4, ...shadows.card },
    cardTitle: { color: c.text, fontWeight: "700" },
    statsList: { gap: 10 },
    nextUp: { color: c.primaryDark, fontWeight: "600", marginBottom: 8 },
    badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    errorText: { color: "#B91C1C" },
  });
}
