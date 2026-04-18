import { useCallback, useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { ActivityIndicator, Snackbar, Text } from "react-native-paper";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TaskListItem } from "@/components/TaskListItem";
import { colors } from "@/theme/theme";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/store/AuthContext";

type ChildTaskRow = {
  id: string;
  child_id: string;
  category: "learning" | "chore";
  title: string;
  xp_reward: number;
  requires_camera: boolean;
  status: "pending" | "in_progress" | "submitted" | "approved" | "rejected" | "completed";
};

function getActionLabel(task: ChildTaskRow) {
  if (task.status === "completed") {
    return "Done";
  }
  if (task.category === "chore" && task.requires_camera) {
    return "Verify";
  }
  return "Complete";
}

export function ChildTasksScreen() {
  const { isSupabaseConfigured } = useAuth();
  const [childId, setChildId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<ChildTaskRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
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

    const { data: child, error: childError } = await supabase.from("children").select("id").eq("child_user_id", user.id).maybeSingle();
    if (childError || !child) {
      setError("No child profile linked to this account.");
      setIsLoading(false);
      return;
    }
    setChildId(child.id as string);

    const { data, error: tasksError } = await supabase
      .from("tasks")
      .select("id, child_id, category, title, xp_reward, requires_camera, status")
      .eq("child_id", child.id)
      .in("status", ["pending", "in_progress", "submitted", "completed"])
      .order("created_at", { ascending: true });

    if (tasksError) {
      setError(tasksError.message);
      setIsLoading(false);
      return;
    }

    setTasks((data as ChildTaskRow[]) ?? []);
    setIsLoading(false);
  }, [isSupabaseConfigured]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const completeTask = async (task: ChildTaskRow) => {
    if (!supabase || !childId || task.status === "completed") {
      return;
    }
    setError(null);
    const nextStatus = task.category === "chore" && task.requires_camera ? "submitted" : "completed";
    const updatePayload: { status: string; completed_at?: string } = { status: nextStatus };
    if (nextStatus === "completed") {
      updatePayload.completed_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase.from("tasks").update(updatePayload).eq("id", task.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    if (nextStatus === "completed") {
      await supabase.from("activity_logs").insert({
        child_id: childId,
        type: "task_completed",
        points: task.xp_reward,
        metadata: { task_id: task.id, title: task.title },
      });
    }

    setSnackbar(nextStatus === "submitted" ? "Task submitted for verification." : "Task completed!");
    await loadTasks();
  };

  const learningTasks = tasks.filter((task) => task.category === "learning");
  const choreTasks = tasks.filter((task) => task.category === "chore");

  return (
    <ScreenContainer scroll>
      <Text variant="headlineMedium" style={styles.title}>
        Daily Missions
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Complete 3 tasks to unlock games.
      </Text>
      {isLoading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Text variant="titleLarge" style={styles.sectionTitle}>
        Learning Tasks
      </Text>
      {learningTasks.length === 0 ? <Text>No learning tasks available.</Text> : null}
      {learningTasks.map((task) => {
        const actionLabel = getActionLabel(task);
        return (
          <TaskListItem
            key={task.id}
            title={task.title}
            subtitle={`Status: ${task.status}`}
            reward={`+${task.xp_reward}`}
            actionLabel={actionLabel}
            actionDisabled={task.status === "completed" || task.status === "submitted"}
            onActionPress={() => void completeTask(task)}
          />
        );
      })}

      <Text variant="titleLarge" style={styles.sectionTitle}>
        Household Chores
      </Text>
      {choreTasks.length === 0 ? <Text>No household chores available.</Text> : null}
      {choreTasks.map((task) => {
        const actionLabel = getActionLabel(task);
        return (
          <TaskListItem
            key={task.id}
            title={task.title}
            subtitle={task.requires_camera ? "Camera verification needed" : `Status: ${task.status}`}
            reward={`+${task.xp_reward}`}
            actionLabel={actionLabel}
            actionDisabled={task.status === "completed" || task.status === "submitted"}
            onActionPress={() => void completeTask(task)}
          />
        );
      })}
      <Snackbar visible={Boolean(snackbar)} onDismiss={() => setSnackbar(null)} duration={1800}>
        {snackbar ?? ""}
      </Snackbar>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.subtext,
    marginBottom: 8,
  },
  sectionTitle: {
    color: colors.text,
    marginTop: 8,
    marginBottom: 4,
    fontWeight: "700",
  },
  errorText: {
    color: "#B91C1C",
  },
});
