import { supabase } from "@/services/supabase";
import type { ChildTaskCategory } from "@/utils/childTaskDisplay";

export type TaskAuditRow = {
  id: string;
  child_id: string;
  title: string;
  category: ChildTaskCategory;
  xp_reward: number;
  status: string;
  requires_camera: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type TaskAuditEvent = {
  at: string;
  title: string;
  detail?: string;
};

function formatLogType(type: string): string {
  const map: Record<string, string> = {
    task_completed: "Stars awarded",
    exercise_completed: "Exercise finished",
    exercise_practice: "Exercise practice",
    game_completed: "Game finished",
    chore_submitted: "Photo submitted",
    chore_approved: "Parent approved",
    chore_rejected: "Parent declined",
  };
  return map[type] ?? type.replace(/_/g, " ");
}

function logMatchesTask(metadata: unknown, taskId: string): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  const m = metadata as Record<string, unknown>;
  return m.task_id === taskId || m.taskId === taskId;
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export { formatWhen };

export async function fetchTaskAuditTrail(task: TaskAuditRow): Promise<TaskAuditEvent[]> {
  if (!supabase) return [];

  const events: TaskAuditEvent[] = [
    {
      at: task.created_at,
      title: "Task assigned",
      detail: `${task.category} · +${task.xp_reward} stars`,
    },
  ];

  if (task.status === "submitted" && task.updated_at !== task.created_at) {
    events.push({
      at: task.updated_at,
      title: "Submitted for review",
      detail: task.requires_camera ? "Waiting for parent approval" : undefined,
    });
  }

  const [{ data: logs }, { data: submissions }] = await Promise.all([
    supabase
      .from("activity_logs")
      .select("type, points, metadata, created_at")
      .eq("child_id", task.child_id)
      .order("created_at", { ascending: true }),
    supabase
      .from("task_submissions")
      .select("status, created_at, reviewed_at, notes")
      .eq("task_id", task.id)
      .order("created_at", { ascending: true }),
  ]);

  for (const sub of submissions ?? []) {
    events.push({
      at: sub.created_at,
      title: "Proof submitted",
      detail: sub.notes ?? "Photo sent to parent",
    });
    if (sub.reviewed_at) {
      events.push({
        at: sub.reviewed_at,
        title: sub.status === "approved" ? "Parent approved" : "Parent reviewed",
        detail: sub.status === "rejected" ? "Try again or ask your parent" : undefined,
      });
    }
  }

  for (const log of logs ?? []) {
    if (!logMatchesTask(log.metadata, task.id)) continue;
    const pts = typeof log.points === "number" && log.points > 0 ? `+${log.points} stars` : undefined;
    events.push({
      at: log.created_at,
      title: formatLogType(log.type),
      detail: pts,
    });
  }

  if (task.completed_at) {
    const hasCompleted = events.some((e) => e.title === "Stars awarded" || e.title === "Task completed");
    if (!hasCompleted) {
      events.push({
        at: task.completed_at,
        title: "Marked complete",
        detail: `+${task.xp_reward} stars`,
      });
    }
  }

  const seen = new Set<string>();
  const unique = events.filter((e) => {
    const key = `${e.at}|${e.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  unique.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return unique;
}
