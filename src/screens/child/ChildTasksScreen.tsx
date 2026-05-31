import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp } from "@react-navigation/native";
import {
  ActivityIndicator,
  Chip,
  Menu,
  Searchbar,
  Snackbar,
  Text,
} from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TaskListItem } from "@/components/TaskListItem";
import { ChildTaskAuditDialog } from "@/components/ChildTaskAuditDialog";
import { ChorePhotoReviewModal } from "@/components/child/ChorePhotoReviewModal";
import { useAppColors } from "@/theme/useAppColors";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/store/AuthContext";
import { useChildProfile } from "@/hooks/useChildProfile";
import { useChildTaskActions } from "@/hooks/useChildTaskActions";
import { formatAppError } from "@/utils/errors";
import type { ChildTabParamList } from "@/types/navigation";
import type { ChildTaskCategory, TaskRow } from "@/utils/childTaskDisplay";
import type { TaskAuditRow } from "@/services/taskAuditTrail";

type CompletedFilter = "all" | ChildTaskCategory;
type CompletedSort = "newest" | "oldest" | "points" | "title";

export function ChildTasksScreen() {
  const tabNav = useNavigation<NavigationProp<ChildTabParamList>>();
  const c = useAppColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const { isSupabaseConfigured } = useAuth();
  const { child, error: profileError } = useChildProfile();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [completedSearch, setCompletedSearch] = useState("");
  const [completedFilter, setCompletedFilter] = useState<CompletedFilter>("all");
  const [completedSort, setCompletedSort] = useState<CompletedSort>("newest");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [auditTask, setAuditTask] = useState<TaskAuditRow | null>(null);

  const loadTasks = useCallback(
    async (fromPull = false) => {
      if (!isSupabaseConfigured || !supabase || !child) {
        setIsLoading(false);
        setRefreshing(false);
        return;
      }
      if (fromPull) setRefreshing(true);
      else setIsLoading(true);
      setError(null);

      const { data, error: tasksError } = await supabase
        .from("tasks")
        .select(
          "id, child_id, category, title, xp_reward, requires_camera, status, description, completed_at, created_at, updated_at"
        )
        .eq("child_id", child.id)
        .in("status", ["pending", "in_progress", "submitted", "completed"])
        .order("created_at", { ascending: true });

      if (tasksError) {
        setError(formatAppError(tasksError));
      } else {
        setTasks((data as TaskRow[]) ?? []);
      }
      setIsLoading(false);
      setRefreshing(false);
    },
    [isSupabaseConfigured, child]
  );

  useEffect(() => {
    if (child) void loadTasks(false);
    else setIsLoading(false);
  }, [child, loadTasks]);

  const onRefresh = useCallback(() => {
    void loadTasks(true);
  }, [loadTasks]);

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

  const refreshAfterChore = useCallback(() => {
    void loadTasks(false);
  }, [loadTasks]);

  const activeTasks = tasks.filter((t) => t.status !== "completed");
  const completedTasks = tasks.filter((t) => t.status === "completed");

  const filteredCompleted = useMemo(() => {
    const q = completedSearch.trim().toLowerCase();
    let list = completedTasks.filter((t) => {
      if (completedFilter !== "all" && t.category !== completedFilter) return false;
      if (!q) return true;
      return t.title.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
    });

    list = [...list].sort((a, b) => {
      switch (completedSort) {
        case "oldest":
          return new Date(a.completed_at ?? a.created_at ?? 0).getTime() - new Date(b.completed_at ?? b.created_at ?? 0).getTime();
        case "points":
          return b.xp_reward - a.xp_reward;
        case "title":
          return a.title.localeCompare(b.title);
        case "newest":
        default:
          return new Date(b.completed_at ?? b.created_at ?? 0).getTime() - new Date(a.completed_at ?? a.created_at ?? 0).getTime();
      }
    });
    return list;
  }, [completedTasks, completedSearch, completedFilter, completedSort]);

  const showError = profileError ?? error ?? actionError;

  const sortLabel =
    completedSort === "newest"
      ? "Newest first"
      : completedSort === "oldest"
        ? "Oldest first"
        : completedSort === "points"
          ? "Most stars"
          : "A → Z";

  const openAudit = (task: TaskRow) => {
    if (!child) return;
    const createdAt = task.created_at ?? task.completed_at ?? new Date().toISOString();
    setAuditTask({
      id: task.id,
      child_id: task.child_id ?? child.id,
      title: task.title,
      category: task.category,
      xp_reward: task.xp_reward,
      status: task.status,
      requires_camera: task.requires_camera,
      description: task.description,
      created_at: createdAt,
      updated_at: task.updated_at ?? createdAt,
      completed_at: task.completed_at ?? null,
    });
  };

  const renderActiveTask = (task: TaskRow) => {
    const actionLabel =
      task.category === "learning"
        ? "Play"
        : task.category === "exercise"
          ? "Start"
          : task.requires_camera && task.status === "submitted"
            ? "Waiting"
            : task.requires_camera
              ? "Take Photo"
              : "Complete";
    const disabled = task.category === "chore" && task.requires_camera && task.status === "submitted";

    return (
      <TaskListItem
        key={task.id}
        title={task.title}
        subtitle={
          task.category === "learning"
            ? `Learning · +${task.xp_reward} stars`
            : task.category === "exercise"
              ? `Movement · +${task.xp_reward} stars`
              : task.requires_camera
                ? "Camera verification"
                : `Chore · +${task.xp_reward} stars`
        }
        reward={`+${task.xp_reward}`}
        actionLabel={actionLabel}
        actionDisabled={disabled}
        actionLoading={uploadingTaskId === task.id}
        onActionPress={() => onTaskPress(task, refreshAfterChore)}
      />
    );
  };

  const renderCompletedTask = (task: TaskRow) => (
    <View key={task.id} style={styles.doneWrap}>
      <TaskListItem
        title={task.title}
        subtitle={
          task.completed_at
            ? `Completed · ${new Date(task.completed_at).toLocaleDateString()}`
            : "Completed"
        }
        reward={`+${task.xp_reward}`}
        actionLabel="History"
        onActionPress={() => openAudit(task)}
      />
    </View>
  );

  return (
    <ScreenContainer scroll onRefresh={onRefresh} refreshing={refreshing}>
      <View style={styles.pad}>
        {showError ? <Text style={styles.errorText}>{showError}</Text> : null}
        {isLoading && !refreshing ? <ActivityIndicator size="small" color={c.primary} /> : null}

        {activeTasks.length === 0 && !isLoading ? (
          <Text style={styles.empty}>No active tasks right now.</Text>
        ) : (
          activeTasks.map(renderActiveTask)
        )}

        {completedTasks.length > 0 ? (
          <>
            <View style={styles.completedHeader}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Completed ({filteredCompleted.length})
              </Text>
              <Menu
                visible={sortMenuOpen}
                onDismiss={() => setSortMenuOpen(false)}
                anchor={
                  <Chip
                    icon="sort"
                    onPress={() => setSortMenuOpen(true)}
                    style={styles.sortChip}
                    textStyle={{ color: c.text }}
                  >
                    {sortLabel}
                  </Chip>
                }
              >
                <Menu.Item onPress={() => { setCompletedSort("newest"); setSortMenuOpen(false); }} title="Newest first" />
                <Menu.Item onPress={() => { setCompletedSort("oldest"); setSortMenuOpen(false); }} title="Oldest first" />
                <Menu.Item onPress={() => { setCompletedSort("points"); setSortMenuOpen(false); }} title="Most stars" />
                <Menu.Item onPress={() => { setCompletedSort("title"); setSortMenuOpen(false); }} title="A → Z" />
              </Menu>
            </View>

            <Searchbar
              placeholder="Search completed tasks"
              value={completedSearch}
              onChangeText={setCompletedSearch}
              style={[styles.search, { backgroundColor: c.card }]}
              inputStyle={{ color: c.text }}
              iconColor={c.subtext}
              placeholderTextColor={c.subtext}
            />

            <View style={styles.filterRow}>
              {(["all", "learning", "exercise", "chore"] as const).map((key) => (
                <Chip
                  key={key}
                  selected={completedFilter === key}
                  onPress={() => setCompletedFilter(key)}
                  compact
                  style={completedFilter === key ? { backgroundColor: c.surfaceTint } : { backgroundColor: c.mutedSurface }}
                  textStyle={{ color: c.text }}
                >
                  {key === "all" ? "All" : key.charAt(0).toUpperCase() + key.slice(1)}
                </Chip>
              ))}
            </View>

            {filteredCompleted.length === 0 ? (
              <View style={styles.noResults}>
                <MaterialCommunityIcons name="magnify-close" size={28} color={c.subtext} />
                <Text style={styles.empty}>No completed tasks match your search.</Text>
              </View>
            ) : (
              filteredCompleted.map(renderCompletedTask)
            )}
          </>
        ) : null}
      </View>

      <ChildTaskAuditDialog task={auditTask} visible={Boolean(auditTask)} onDismiss={() => setAuditTask(null)} />

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

function createStyles(c: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    pad: { paddingBottom: 24, gap: 8 },
    sectionTitle: { color: c.text, fontWeight: "700" },
    completedHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 16,
      gap: 8,
    },
    sortChip: { backgroundColor: c.mutedSurface },
    search: { marginTop: 4 },
    filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
    empty: { color: c.subtext },
    noResults: { alignItems: "center", gap: 8, paddingVertical: 16 },
    doneWrap: { opacity: 0.92 },
    errorText: { color: "#B91C1C" },
  });
}
