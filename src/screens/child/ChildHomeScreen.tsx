import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp } from "@react-navigation/native";
import { ActivityIndicator, Card, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ChildDashboardHeader } from "@/components/ChildDashboardHeader";
import { colors, radii, shadows } from "@/theme/theme";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/store/AuthContext";
import { useChildProfile } from "@/hooks/useChildProfile";
import { formatAppError } from "@/utils/errors";
import { CHILD_GAME_CATALOG } from "@/data/childGames";
import type { ChildTabParamList } from "@/types/navigation";

type TaskPreview = {
  id: string;
  title: string;
};

export function ChildHomeScreen() {
  const navigation = useNavigation<NavigationProp<ChildTabParamList>>();
  const { isSupabaseConfigured } = useAuth();
  const { child, loading: profileLoading, error: profileError, refresh: refreshProfile } = useChildProfile();
  const [tasks, setTasks] = useState<TaskPreview[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [loading, setLoading] = useState(true);
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
        .select("id, title")
        .eq("child_id", child.id)
        .in("status", ["pending", "in_progress"])
        .order("created_at", { ascending: true })
        .limit(3);

      if (tasksError) {
        setError(formatAppError(tasksError));
        setLoading(false);
        setRefreshing(false);
        return;
      }
      setTasks((pendingTasks as TaskPreview[]) ?? []);

      const { count, error: countError } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("child_id", child.id)
        .eq("status", "completed");

      if (countError) {
        setError(formatAppError(countError));
        setLoading(false);
        setRefreshing(false);
        return;
      }
      setCompletedCount(count ?? 0);
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
  }, [refreshProfile, loadHomeData]);

  const showError = profileError ?? error;

  return (
    <ScreenContainer scroll contentPadding={0} onRefresh={onRefresh} refreshing={refreshing}>
      <View style={styles.content}>
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

          <Card style={styles.streakCard}>
            <Card.Content style={styles.streakInner}>
              <MaterialCommunityIcons name="fire" size={40} color="#FFFFFF" />
              <View style={styles.streakText}>
                <Text variant="titleLarge" style={styles.streakTitle}>
                  Keep your streak!
                </Text>
                <Text variant="bodyMedium" style={styles.streakSub}>
                  {completedCount} tasks completed so far. Keep learning daily.
                </Text>
              </View>
              <View style={styles.streakBadge}>
                <Text variant="labelLarge" style={styles.streakBadgeText}>
                  {completedCount}
                </Text>
              </View>
            </Card.Content>
          </Card>

          <Text variant="titleLarge" style={styles.sectionTitle}>
            Today&apos;s Tasks
          </Text>
          <Card style={styles.taskCard}>
            <Card.Content style={styles.listBlock}>
              {loading && !refreshing ? <ActivityIndicator size="small" color={colors.primary} /> : null}
              {!loading && tasks.length === 0 ? (
                <Text style={styles.emptyText}>No pending tasks yet. You&apos;re all caught up!</Text>
              ) : (
                tasks.map((task) => (
                  <View key={task.id} style={styles.taskRow}>
                    <MaterialCommunityIcons name="book-open-variant" size={22} color={colors.primary} />
                    <Text variant="bodyLarge" style={styles.taskTitle}>
                      {task.title}
                    </Text>
                  </View>
                ))
              )}
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

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  pad: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  streakCard: {
    backgroundColor: colors.streak,
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
  sectionTitle: {
    color: colors.text,
    fontWeight: "700",
    marginTop: 4,
  },
  taskCard: {
    borderRadius: radii.md,
    ...shadows.card,
  },
  listBlock: {
    gap: 12,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  taskTitle: {
    color: colors.text,
    flex: 1,
  },
  emptyText: {
    color: colors.subtext,
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
