export type TaskRow = {
  child_id: string;
  title: string;
  category: "learning" | "exercise" | "chore";
  status: string;
  created_at: string;
  completed_at: string | null;
};

export type ChildRow = {
  id: string;
  name: string;
  stars: number;
  daily_limit_minutes: number;
  difficulty_level: number;
  is_online: boolean;
  last_seen_at: string | null;
  child_user_id: string | null;
  avatar_url?: string | null;
};

export type ChildMonitor = {
  childId: string;
  childName: string;
  isOnline: boolean;
  lastSeenLabel: string;
  hasLinkedAccount: boolean;
  stars: number;
  pendingReview: number;
  activeTasks: number;
  completedThisWeek: number;
  completionRatePct: number;
  weekByCategory: { learning: number; exercise: number; chore: number };
};

export type TaskPipeline = {
  pending: number;
  in_progress: number;
  awaiting_review: number;
  completed: number;
};

export type WeekAnalytics = {
  byCategory: { learning: number; exercise: number; chore: number };
  totalCompleted: number;
  priorWeekCompleted: number;
  trendLabel: string;
  pointsThisWeek: number;
};

export type ParentDashboardAnalytics = {
  monitors: ChildMonitor[];
  pipeline: TaskPipeline;
  week: WeekAnalytics;
  pendingReviewsTotal: number;
  onlineCount: number;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function formatLastSeen(iso: string | null, isOnline: boolean): string {
  if (isOnline) return "Active now";
  if (!iso) return "No check-in yet";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function buildParentDashboardAnalytics(params: {
  children: ChildRow[];
  tasks: TaskRow[];
  pendingReviewsByChild: Record<string, number>;
  activityPointsThisWeek: number;
}): ParentDashboardAnalytics {
  const now = Date.now();
  const weekStart = now - WEEK_MS;
  const priorWeekStart = now - 2 * WEEK_MS;

  const pipeline: TaskPipeline = {
    pending: 0,
    in_progress: 0,
    awaiting_review: 0,
    completed: 0,
  };

  let priorWeekCompleted = 0;
  const weekByCategory = { learning: 0, exercise: 0, chore: 0 };

  for (const t of params.tasks) {
    if (t.status === "pending") pipeline.pending += 1;
    else if (t.status === "in_progress") pipeline.in_progress += 1;
    else if (t.status === "submitted") pipeline.awaiting_review += 1;
    else if (t.status === "completed" || t.status === "approved") pipeline.completed += 1;

    if (t.status !== "completed" || !t.completed_at) continue;
    const doneAt = new Date(t.completed_at).getTime();
    if (doneAt >= weekStart) {
      weekByCategory[t.category] += 1;
    } else if (doneAt >= priorWeekStart && doneAt < weekStart) {
      priorWeekCompleted += 1;
    }
  }

  const weekTotal = weekByCategory.learning + weekByCategory.exercise + weekByCategory.chore;
  let trendLabel = "Same as last week";
  if (weekTotal > priorWeekCompleted) trendLabel = `Up ${weekTotal - priorWeekCompleted} vs last week`;
  else if (weekTotal < priorWeekCompleted) trendLabel = `Down ${priorWeekCompleted - weekTotal} vs last week`;

  const monitors: ChildMonitor[] = params.children.map((c) => {
    const childTasks = params.tasks.filter((t) => t.child_id === c.id);
    const completed = childTasks.filter((t) => t.status === "completed");
    const completedWeek = completed.filter(
      (t) => t.completed_at && now - new Date(t.completed_at).getTime() <= WEEK_MS
    );
    const weekCat = { learning: 0, exercise: 0, chore: 0 };
    for (const t of completedWeek) {
      weekCat[t.category] += 1;
    }
    const activeTasks = childTasks.filter((t) => !["completed", "rejected"].includes(t.status)).length;
    const assigned = childTasks.length;
    const completionRatePct = assigned > 0 ? Math.round((completed.length / assigned) * 100) : 0;

    return {
      childId: c.id,
      childName: c.name,
      isOnline: c.is_online,
      lastSeenLabel: formatLastSeen(c.last_seen_at, c.is_online),
      hasLinkedAccount: Boolean(c.child_user_id),
      stars: c.stars ?? 0,
      pendingReview: params.pendingReviewsByChild[c.id] ?? 0,
      activeTasks,
      completedThisWeek: completedWeek.length,
      completionRatePct,
      weekByCategory: weekCat,
    };
  });

  const pendingReviewsTotal = Object.values(params.pendingReviewsByChild).reduce((a, b) => a + b, 0);
  const onlineCount = params.children.filter((c) => c.is_online).length;

  return {
    monitors,
    pipeline,
    week: {
      byCategory: weekByCategory,
      totalCompleted: weekTotal,
      priorWeekCompleted,
      trendLabel,
      pointsThisWeek: params.activityPointsThisWeek,
    },
    pendingReviewsTotal,
    onlineCount,
  };
}
