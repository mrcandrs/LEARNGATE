import { useCallback, useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { ActivityIndicator, Card, Text } from "react-native-paper";
import { ScreenContainer } from "@/components/ScreenContainer";
import { colors } from "@/theme/theme";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/store/AuthContext";

type ChildSummary = {
  id: string;
  name: string;
  age: number;
  difficulty_level: number;
  stars: number;
  daily_limit_minutes: number;
};

type TaskPreview = {
  id: string;
  title: string;
};

export function ChildHomeScreen() {
  const { isSupabaseConfigured } = useAuth();
  const [child, setChild] = useState<ChildSummary | null>(null);
  const [tasks, setTasks] = useState<TaskPreview[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHomeData = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
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
      setError("Unable to resolve child session.");
      setIsLoading(false);
      return;
    }

    const { data: childRow, error: childError } = await supabase
      .from("children")
      .select("id, name, age, difficulty_level, stars, daily_limit_minutes")
      .eq("child_user_id", user.id)
      .maybeSingle();

    if (childError || !childRow) {
      setError("No child profile linked to this account.");
      setIsLoading(false);
      return;
    }

    setChild(childRow as ChildSummary);

    const { data: pendingTasks, error: tasksError } = await supabase
      .from("tasks")
      .select("id, title")
      .eq("child_id", childRow.id)
      .in("status", ["pending", "in_progress"])
      .order("created_at", { ascending: true })
      .limit(3);

    if (tasksError) {
      setError(tasksError.message);
      setIsLoading(false);
      return;
    }
    setTasks((pendingTasks as TaskPreview[]) ?? []);

    const { count, error: countError } = await supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("child_id", childRow.id)
      .eq("status", "completed");

    if (countError) {
      setError(countError.message);
      setIsLoading(false);
      return;
    }
    setCompletedCount(count ?? 0);
    setIsLoading(false);
  }, [isSupabaseConfigured]);

  useEffect(() => {
    void loadHomeData();
  }, [loadHomeData]);

  return (
    <ScreenContainer scroll>
      {isLoading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Card style={styles.headerCard}>
        <Card.Content>
          <Text variant="headlineSmall" style={styles.headerTitle}>
            Hello, {child?.name ?? "Learner"}!
          </Text>
          <Text variant="bodyMedium" style={styles.headerSub}>
            Level {child?.difficulty_level ?? 1} • {child?.stars ?? 0} stars •{" "}
            {Math.round((child?.daily_limit_minutes ?? 120) / 60)}h left
          </Text>
        </Card.Content>
      </Card>

      <Card style={styles.streakCard}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.streakTitle}>
            Keep Going!
          </Text>
          <Text>Completed tasks: {completedCount}</Text>
        </Card.Content>
      </Card>

      <Text variant="headlineSmall" style={styles.sectionTitle}>
        Today's Tasks
      </Text>
      <Card>
        <Card.Content style={styles.listBlock}>
          {tasks.length === 0 ? <Text>No pending tasks yet.</Text> : tasks.map((task) => <Text key={task.id}>{task.title}</Text>)}
        </Card.Content>
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    backgroundColor: colors.primary,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  headerSub: {
    color: "#EAFBEF",
    marginTop: 4,
  },
  streakCard: {
    backgroundColor: "#F5B614",
  },
  streakTitle: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: "700",
  },
  listBlock: {
    gap: 10,
  },
  errorText: {
    color: "#B91C1C",
  },
});
