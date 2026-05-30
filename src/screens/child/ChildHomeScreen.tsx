import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp } from "@react-navigation/native";
import { ActivityIndicator, Card, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ChildDashboardHeader } from "@/components/ChildDashboardHeader";
import { radii, shadows, colors as legacyColors } from "@/theme/theme";
import { useAppColors } from "@/theme/useAppColors";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/store/AuthContext";
import { useChildAchievements } from "@/hooks/useChildAchievements";
import { useChildProfile } from "@/hooks/useChildProfile";
import { formatAppError } from "@/utils/errors";
import { CHILD_GAME_CATALOG } from "@/data/childGames";
import type { ChildTabParamList } from "@/types/navigation";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

type TaskPreview = {
  id: string;
  title: string;
  category: "learning" | "exercise" | "chore";
  xp_reward: number;
  status: "pending" | "in_progress" | "submitted";
};

function categoryMeta(category: TaskPreview["category"]): { icon: IconName; label: string } {
  if (category === "learning") return { icon: "book-open-variant", label: "Learning" };
  if (category === "exercise") return { icon: "run", label: "Exercise" };
  return { icon: "broom", label: "Chore" };
}

function statusLabel(status: TaskPreview["status"]): string {
  if (status === "in_progress") return "In progress";
  if (status === "submitted") return "Waiting for review";
  return "Not started";
}

export function ChildHomeScreen() {
  const navigation = useNavigation<NavigationProp<ChildTabParamList>>();
  const c = useAppColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const { isSupabaseConfigured } = useAuth();
  const { child, loading: profileLoading, error: profileError, refresh: refreshProfile } = useChildProfile();
  const [tasks, setTasks] = useState<TaskPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const { stats: achievementStats, unlockedCount, totalCount, nextUp, refresh: refreshAchievements } =
    useChildAchievements(child);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        .select("id, title, category, xp_reward, status")
        .eq("child_id", child.id)
        .in("status", ["pending", "in_progress", "submitted"])
        .order("created_at", { ascending: true })
        .limit(5);

      if (tasksError) {
        setError(formatAppError(tasksError));
        setLoading(false);
        setRefreshing(false);
        return;
      }
      setTasks((pendingTasks as TaskPreview[]) ?? []);

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
  const showError = profileError ?? error;
  const previewTasks = tasks.slice(0, 4);

  return (
    <ScreenContainer scroll contentPadding={0} includeTopInset={false} onRefresh={onRefresh} refreshing={refreshing}>
      <View style={styles.content}>
        {child ? (
          <ChildDashboardHeader
            name={child.name}
            level={child.difficulty_level}
            stars={child.stars}
            avatarUrl={child.avatar_url}
          />
        ) : null}

        <View style={styles.pad}>
          {profileLoading && !refreshing ? <ActivityIndicator size="small" color={c.primary} /> : null}
          {showError ? <Text style={styles.errorText}>{showError}</Text> : null}

          <Card style={styles.streakCard}>
            <Card.Content style={styles.streakInner}>
              <MaterialCommunityIcons name="fire" size={40} color="#FFFFFF" />
              <View style={styles.streakText}>
                <Text variant="titleLarge" style={styles.streakTitle}>
                  {streakDays > 0 ? `${streakDays}-day streak!` : "Start your streak"}
                </Text>
                <Text variant="bodyMedium" style={styles.streakSub}>
                  {streakDays > 0
                    ? `Active ${streakDays} day${streakDays === 1 ? "" : "s"} in a row. ${unlockedCount}/${totalCount} achievements unlocked.`
                    : nextUp
                      ? `Complete a task today — next badge: ${nextUp.definition.title}.`
                      : "Complete a task or game today to begin your streak."}
                </Text>
              </View>
              <View style={styles.streakBadge}>
                <Text variant="labelLarge" style={styles.streakBadgeText}>
                  {streakDays}
                </Text>
              </View>
            </Card.Content>
          </Card>

          <View style={styles.sectionHeader}>
            <View>
              <Text variant="titleLarge" style={styles.sectionTitle}>
                Today&apos;s Tasks
              </Text>
              <Text variant="bodySmall" style={styles.sectionSub}>
                {tasks.length === 0 ? "You're all caught up" : `${tasks.length} to do today`}
              </Text>
            </View>
            <Pressable onPress={() => navigation.navigate("Tasks")} accessibilityRole="button">
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>

          <Card style={styles.taskCard}>
            <Card.Content style={styles.listBlock}>
              {loading && !refreshing ? <ActivityIndicator size="small" color={c.primary} /> : null}
              {!loading && previewTasks.length === 0 ? (
                <Text style={styles.emptyText}>No pending tasks yet. You&apos;re all caught up!</Text>
              ) : (
                previewTasks.map((task, index) => {
                  const meta = categoryMeta(task.category);
                  return (
                    <Pressable
                      key={task.id}
                      onPress={() => navigation.navigate("Tasks")}
                      style={[
                        styles.taskRow,
                        index < previewTasks.length - 1 && { borderBottomColor: c.border, borderBottomWidth: 1 },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Open task ${task.title}`}
                    >
                      <View style={[styles.taskIconWrap, { backgroundColor: c.surfaceTint }]}>
                        <MaterialCommunityIcons name={meta.icon} size={22} color={c.primaryDark} />
                      </View>
                      <View style={styles.taskText}>
                        <Text variant="bodyLarge" style={styles.taskTitle} numberOfLines={1}>
                          {task.title}
                        </Text>
                        <Text variant="bodySmall" style={styles.taskMeta}>
                          {meta.label} · {statusLabel(task.status)}
                        </Text>
                      </View>
                      <Text style={styles.taskReward}>+{task.xp_reward}</Text>
                    </Pressable>
                  );
                })
              )}
              {tasks.length > previewTasks.length ? (
                <Pressable onPress={() => navigation.navigate("Tasks")} style={styles.moreTasksBtn}>
                  <Text style={styles.moreTasksText}>+{tasks.length - previewTasks.length} more in Tasks</Text>
                </Pressable>
              ) : null}
            </Card.Content>
          </Card>

          <Text variant="titleLarge" style={styles.sectionTitle}>
            Recommended Games
          </Text>
          <View style={styles.gameRow}>
            {CHILD_GAME_CATALOG.slice(0, 2).map((game) => (
              <Pressable
                key={game.id}
                accessibilityRole="button"
                accessibilityLabel={`Play ${game.title}`}
                style={({ pressed }) => [styles.gameMiniWrap, pressed && styles.gameMiniPressed]}
                onPress={() =>
                  navigation.navigate("Games", {
                    screen: "GamePlay",
                    params: { gameId: game.id, title: game.title },
                  })
                }
              >
                <Card style={[styles.gameMini, { backgroundColor: game.color }, shadows.card]}>
                  <View style={styles.gameMiniTop}>
                    <Text style={styles.gameMiniTitle}>{game.glyph}</Text>
                    <MaterialCommunityIcons name="play-circle" size={26} color="rgba(255,255,255,0.95)" />
                  </View>
                  <Text variant="labelMedium" style={styles.gameMiniSub}>
                    {game.title}
                  </Text>
                  <Text variant="bodySmall" style={styles.xp}>
                    +50 XP
                  </Text>
                </Card>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

function createStyles(c: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    content: {
      flex: 1,
    },
    pad: {
      paddingHorizontal: 16,
      paddingBottom: 24,
      gap: 12,
    },
    streakCard: {
      backgroundColor: legacyColors.streak,
      borderRadius: radii.md,
      ...shadows.card,
    },
    streakInner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    streakText: {
      flex: 1,
    },
    streakTitle: {
      color: "#FFFFFF",
      fontWeight: "700",
    },
    streakSub: {
      color: "rgba(255,255,255,0.95)",
      marginTop: 4,
    },
    streakBadge: {
      backgroundColor: "rgba(255,255,255,0.25)",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radii.sm,
    },
    streakBadgeText: {
      color: "#FFFFFF",
      fontWeight: "800",
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      marginTop: 4,
      gap: 12,
    },
    sectionTitle: {
      color: c.text,
      fontWeight: "700",
    },
    sectionSub: {
      color: c.subtext,
      marginTop: 2,
    },
    seeAll: {
      color: c.primary,
      fontWeight: "700",
      fontSize: 14,
    },
    taskCard: {
      borderRadius: radii.md,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      ...shadows.card,
    },
    listBlock: {
      gap: 0,
    },
    taskRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 12,
    },
    taskIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    taskText: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    taskTitle: {
      color: c.text,
      fontWeight: "700",
    },
    taskMeta: {
      color: c.subtext,
    },
    taskReward: {
      color: c.warning,
      fontWeight: "800",
      fontSize: 15,
    },
    moreTasksBtn: {
      paddingTop: 10,
      alignItems: "center",
    },
    moreTasksText: {
      color: c.primaryDark,
      fontWeight: "700",
    },
    emptyText: {
      color: c.subtext,
      paddingVertical: 8,
    },
    gameRow: {
      flexDirection: "row",
      gap: 10,
    },
    gameMiniWrap: {
      flex: 1,
    },
    gameMiniPressed: {
      opacity: 0.92,
      transform: [{ scale: 0.98 }],
    },
    gameMini: {
      flex: 1,
      minHeight: 108,
      padding: 12,
      borderRadius: radii.md,
      justifyContent: "space-between",
    },
    gameMiniTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    gameMiniTitle: {
      color: "#FFFFFF",
      fontSize: 28,
      fontWeight: "800",
    },
    gameMiniSub: {
      color: "rgba(255,255,255,0.95)",
      marginTop: 4,
    },
    xp: {
      color: "rgba(255,255,255,0.9)",
      marginTop: 8,
    },
    errorText: {
      color: "#B91C1C",
    },
  });
}
