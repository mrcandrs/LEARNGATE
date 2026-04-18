import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Card, Snackbar, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TaskListItem } from "@/components/TaskListItem";
import { ChildDashboardHeader } from "@/components/ChildDashboardHeader";
import { colors, radii, shadows } from "@/theme/theme";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/store/AuthContext";
import { useChildProfile } from "@/hooks/useChildProfile";
import { pickTaskPhotoFromCamera, uploadTaskEvidencePhoto } from "@/services/taskEvidence";
import { formatAppError } from "@/utils/errors";

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
    if (task.status === "submitted") {
      return "Waiting";
    }
    return "Verify";
  }
  return "Complete";
}

function isActionDisabled(task: ChildTaskRow) {
  if (task.status === "completed") {
    return true;
  }
  if (task.category === "chore" && task.requires_camera && task.status === "submitted") {
    return true;
  }
  return false;
}

export function ChildTasksScreen() {
  const { isSupabaseConfigured } = useAuth();
  const { child, loading: profileLoading, error: profileError, refresh: refreshProfile } = useChildProfile();
  const [tasks, setTasks] = useState<ChildTaskRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [uploadingTaskId, setUploadingTaskId] = useState<string | null>(null);

  const loadTasks = useCallback(
    async (fromPull = false) => {
      if (!isSupabaseConfigured || !supabase || !child) {
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

      const { data, error: tasksError } = await supabase
        .from("tasks")
        .select("id, child_id, category, title, xp_reward, requires_camera, status")
        .eq("child_id", child.id)
        .in("status", ["pending", "in_progress", "submitted", "completed"])
        .order("created_at", { ascending: true });

      if (tasksError) {
        setError(formatAppError(tasksError));
        setIsLoading(false);
        setRefreshing(false);
        return;
      }

      setTasks((data as ChildTaskRow[]) ?? []);
      setIsLoading(false);
      setRefreshing(false);
    },
    [isSupabaseConfigured, child]
  );

  useEffect(() => {
    if (child) {
      void loadTasks(false);
    } else if (!profileLoading) {
      setIsLoading(false);
    }
  }, [child, profileLoading, loadTasks]);

  const onRefresh = useCallback(() => {
    void refreshProfile();
    void loadTasks(true);
  }, [refreshProfile, loadTasks]);

  const completeTaskWithoutCamera = async (task: ChildTaskRow) => {
    if (!supabase || !child || task.status === "completed") {
      return;
    }
    setError(null);

    const { error: updateError } = await supabase
      .from("tasks")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", task.id);

    if (updateError) {
      setError(formatAppError(updateError));
      return;
    }

    await supabase.from("activity_logs").insert({
      child_id: child.id,
      type: "task_completed",
      points: task.xp_reward,
      metadata: { task_id: task.id, title: task.title },
    });

    setSnackbar("Task completed!");
    await loadTasks(false);
  };

  const verifyChoreWithCamera = async (task: ChildTaskRow) => {
    if (!supabase || !child) {
      return;
    }
    setError(null);
    setUploadingTaskId(task.id);

    try {
      const uri = await pickTaskPhotoFromCamera();
      if (!uri) {
        return;
      }

      const path = await uploadTaskEvidencePhoto({ childId: child.id, taskId: task.id, localUri: uri });

      const { error: insertError } = await supabase.from("task_submissions").insert({
        task_id: task.id,
        child_id: child.id,
        image_url: path,
        status: "submitted",
      });

      if (insertError) {
        setError(formatAppError(insertError));
        return;
      }

      const { error: taskUpdateError } = await supabase.from("tasks").update({ status: "submitted" }).eq("id", task.id);

      if (taskUpdateError) {
        setError(formatAppError(taskUpdateError));
        return;
      }

      await supabase.from("activity_logs").insert({
        child_id: child.id,
        type: "chore_submitted",
        points: 0,
        metadata: { task_id: task.id, title: task.title, storage_path: path },
      });

      setSnackbar("Photo submitted for parent review.");
      await loadTasks(false);
    } catch (e) {
      setError(formatAppError(e));
    } finally {
      setUploadingTaskId(null);
    }
  };

  const onTaskAction = (task: ChildTaskRow) => {
    if (task.category === "chore" && task.requires_camera) {
      return verifyChoreWithCamera(task);
    }
    return completeTaskWithoutCamera(task);
  };

  const learningTasks = tasks.filter((task) => task.category === "learning");
  const choreTasks = tasks.filter((task) => task.category === "chore");
  const pendingCount = tasks.filter((t) => t.status === "pending" || t.status === "in_progress").length;
  const totalActive = tasks.filter((t) => t.status !== "completed").length;

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
        <Card style={styles.missionCard}>
          <Card.Content style={styles.missionRow}>
            <View style={styles.missionIcon}>
              <MaterialCommunityIcons name="check-circle" size={28} color={colors.primary} />
            </View>
            <View style={styles.missionText}>
              <Text variant="titleMedium" style={styles.missionTitle}>
                Daily Missions
              </Text>
              <Text variant="bodySmall" style={styles.missionSub}>
                Complete tasks to unlock games and earn stars.
              </Text>
            </View>
            <View style={styles.missionCount}>
              <Text variant="labelLarge" style={styles.missionCountText}>
                {pendingCount}/{Math.max(totalActive, 1)} Tasks
              </Text>
            </View>
          </Card.Content>
        </Card>

        {profileLoading && !refreshing ? <ActivityIndicator size="small" color={colors.primary} /> : null}
        {showError ? <Text style={styles.errorText}>{showError}</Text> : null}
        {isLoading && !refreshing ? <ActivityIndicator size="small" color={colors.primary} /> : null}

        <Text variant="titleLarge" style={styles.sectionTitle}>
          Learning Tasks
        </Text>
        {learningTasks.length === 0 ? (
          <Text style={styles.empty}>No learning tasks right now.</Text>
        ) : null}
        {learningTasks.map((task) => {
          const actionLabel = getActionLabel(task);
          return (
            <TaskListItem
              key={task.id}
              title={task.title}
              subtitle={`Status: ${task.status}`}
              reward={`+${task.xp_reward}`}
              actionLabel={actionLabel}
              actionDisabled={isActionDisabled(task)}
              actionLoading={uploadingTaskId === task.id}
              onActionPress={() => void onTaskAction(task)}
            />
          );
        })}

        <Text variant="titleLarge" style={styles.sectionTitle}>
          Household Chores
        </Text>
        {choreTasks.length === 0 ? <Text style={styles.empty}>No chores assigned.</Text> : null}
        {choreTasks.map((task) => {
          const actionLabel = getActionLabel(task);
          return (
            <TaskListItem
              key={task.id}
              title={task.title}
              subtitle={task.requires_camera ? "Camera verification needed" : `Status: ${task.status}`}
              reward={`+${task.xp_reward}`}
              actionLabel={actionLabel}
              actionDisabled={isActionDisabled(task)}
              actionLoading={uploadingTaskId === task.id}
              onActionPress={() => void onTaskAction(task)}
            />
          );
        })}
        <Snackbar visible={Boolean(snackbar)} onDismiss={() => setSnackbar(null)} duration={2200}>
          {snackbar ?? ""}
        </Snackbar>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pad: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 4,
  },
  missionCard: {
    backgroundColor: colors.primaryDark,
    borderRadius: radii.md,
    marginBottom: 8,
    ...shadows.card,
  },
  missionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  missionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  missionText: {
    flex: 1,
  },
  missionTitle: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  missionSub: {
    color: "rgba(255,255,255,0.9)",
    marginTop: 2,
  },
  missionCount: {
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radii.sm,
  },
  missionCountText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  sectionTitle: {
    color: colors.text,
    marginTop: 12,
    marginBottom: 6,
    fontWeight: "700",
  },
  empty: {
    color: colors.subtext,
    marginBottom: 8,
  },
  errorText: {
    color: "#B91C1C",
  },
});
