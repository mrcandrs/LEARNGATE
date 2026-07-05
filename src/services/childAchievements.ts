import { supabase } from "@/services/supabase";
import {
  ACHIEVEMENT_CATEGORY_ORDER,
  ACHIEVEMENT_DEFINITIONS,
  ACHIEVEMENT_LADDERS,
  type AchievementCategory,
  type AchievementDefinition,
  type AchievementLadder,
  type ChildAchievementStats,
} from "@/data/achievements";

export type { ChildAchievementStats } from "@/data/achievements";

export type AchievementProgress = {
  definition: AchievementDefinition;
  unlocked: boolean;
  progress: { current: number; target: number };
};

export type LadderTierProgress = {
  definition: AchievementDefinition;
  unlocked: boolean;
  progress: { current: number; target: number };
};

export type AchievementLadderProgress = {
  ladder: AchievementLadder;
  currentValue: number;
  tiers: LadderTierProgress[];
  unlockedCount: number;
  /** Progress toward the next locked step (0–1 within that segment). */
  segmentProgress: number;
  nextTier: LadderTierProgress | null;
};

export type AchievementCategoryGroup = {
  category: AchievementCategory;
  ladders: AchievementLadderProgress[];
  unlockedCount: number;
  totalCount: number;
};

function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Consecutive calendar days with activity, counting back from today. */
export function computeDailyStreak(activeDayKeys: string[]): number {
  const days = new Set(activeDayKeys);
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export function evaluateAchievements(stats: ChildAchievementStats): AchievementProgress[] {
  return ACHIEVEMENT_DEFINITIONS.map((definition) => ({
    definition,
    unlocked: definition.isUnlocked(stats),
    progress: definition.progress(stats),
  }));
}

function computeSegmentProgress(ladder: AchievementLadder, currentValue: number): number {
  const tiers = ladder.tiers;
  if (tiers.length === 0) {
    return 0;
  }
  if (currentValue >= tiers[tiers.length - 1].target) {
    return 1;
  }

  let prevTarget = 0;
  for (const tier of tiers) {
    if (currentValue < tier.target) {
      const span = tier.target - prevTarget;
      if (span <= 0) {
        return 0;
      }
      return (currentValue - prevTarget) / span;
    }
    prevTarget = tier.target;
  }
  return 1;
}

export function evaluateAchievementLadders(stats: ChildAchievementStats): AchievementLadderProgress[] {
  return ACHIEVEMENT_LADDERS.map((ladder) => {
    const currentValue = ladder.getValue(stats);
    const tiers: LadderTierProgress[] = ladder.tiers.map((tier) => {
      const definition = ACHIEVEMENT_DEFINITIONS.find((d) => d.id === tier.id)!;
      return {
        definition,
        unlocked: currentValue >= tier.target,
        progress: definition.progress(stats),
      };
    });
    const unlockedCount = tiers.filter((t) => t.unlocked).length;
    const nextTier = tiers.find((t) => !t.unlocked) ?? null;

    return {
      ladder,
      currentValue,
      tiers,
      unlockedCount,
      segmentProgress: computeSegmentProgress(ladder, currentValue),
      nextTier,
    };
  });
}

export function groupLaddersByCategory(ladders: AchievementLadderProgress[]): AchievementCategoryGroup[] {
  const byCategory = new Map<AchievementCategory, AchievementLadderProgress[]>();

  for (const ladder of ladders) {
    const cat = ladder.ladder.category;
    const list = byCategory.get(cat) ?? [];
    list.push(ladder);
    byCategory.set(cat, list);
  }

  return ACHIEVEMENT_CATEGORY_ORDER.filter((cat) => byCategory.has(cat)).map((category) => {
    const groupLadders = byCategory.get(category)!;
    let unlockedCount = 0;
    let totalCount = 0;
    for (const l of groupLadders) {
      unlockedCount += l.unlockedCount;
      totalCount += l.tiers.length;
    }
    return { category, ladders: groupLadders, unlockedCount, totalCount };
  });
}

export async function fetchChildAchievementStats(child: {
  id: string;
  stars: number;
  stars_lifetime?: number;
  difficulty_level: number;
}): Promise<ChildAchievementStats> {
  const lifetimeStars = child.stars_lifetime ?? child.stars ?? 0;

  if (!supabase) {
    return {
      stars: lifetimeStars,
      starsThisWeek: child.stars ?? 0,
      difficultyLevel: child.difficulty_level ?? 1,
      completedTasks: 0,
      completedLearning: 0,
      completedExercise: 0,
      completedChores: 0,
      gamesCompleted: 0,
      choreSubmissions: 0,
      dailyStreak: 0,
      activeDaysLast14: 0,
    };
  }

  const childId = child.id;
  const since = new Date();
  since.setDate(since.getDate() - 90);

  const [tasksRes, activityRes, submissionsRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("category, status, completed_at")
      .eq("child_id", childId)
      .eq("status", "completed"),
    supabase
      .from("activity_logs")
      .select("type, created_at, points")
      .eq("child_id", childId)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("task_submissions")
      .select("*", { count: "exact", head: true })
      .eq("child_id", childId),
  ]);

  const completed = tasksRes.data ?? [];
  const completedLearning = completed.filter((t) => t.category === "learning").length;
  const completedExercise = completed.filter((t) => t.category === "exercise").length;
  const completedChores = completed.filter((t) => t.category === "chore").length;

  const activity = activityRes.data ?? [];
  const gamesCompleted = activity.filter((a) =>
    ["game_completed", "game_played", "learning_completed"].includes(a.type)
  ).length;
  const choreSubmissionsFromLogs = activity.filter((a) => a.type === "chore_submitted").length;

  const activeDayKeys = new Set<string>();
  for (const row of completed) {
    if (row.completed_at) {
      activeDayKeys.add(dayKey(new Date(row.completed_at)));
    }
  }
  for (const row of activity) {
    if ((row.points ?? 0) > 0 || row.type.includes("completed") || row.type.includes("submitted")) {
      activeDayKeys.add(dayKey(new Date(row.created_at)));
    }
  }

  const last14 = new Date();
  last14.setDate(last14.getDate() - 13);
  last14.setHours(0, 0, 0, 0);
  let activeDaysLast14 = 0;
  for (const key of activeDayKeys) {
    const d = new Date(`${key}T12:00:00`);
    if (d >= last14) {
      activeDaysLast14 += 1;
    }
  }

  return {
    stars: lifetimeStars,
    starsThisWeek: child.stars ?? 0,
    difficultyLevel: child.difficulty_level ?? 1,
    completedTasks: completed.length,
    completedLearning,
    completedExercise,
    completedChores,
    gamesCompleted,
    choreSubmissions: Math.max(submissionsRes.count ?? 0, choreSubmissionsFromLogs),
    dailyStreak: computeDailyStreak([...activeDayKeys]),
    activeDaysLast14,
  };
}

export function getNextLockedAchievement(progress: AchievementProgress[]): AchievementProgress | null {
  const locked = progress.filter((p) => !p.unlocked);
  if (locked.length === 0) {
    return null;
  }
  locked.sort((a, b) => {
    const aPct = a.progress.target > 0 ? a.progress.current / a.progress.target : 0;
    const bPct = b.progress.target > 0 ? b.progress.current / b.progress.target : 0;
    return bPct - aPct;
  });
  return locked[0];
}

export function getNextLockedTier(ladders: AchievementLadderProgress[]): LadderTierProgress | null {
  const candidates: LadderTierProgress[] = [];
  for (const ladder of ladders) {
    if (ladder.nextTier) {
      candidates.push(ladder.nextTier);
    }
  }
  if (candidates.length === 0) {
    return null;
  }
  candidates.sort((a, b) => {
    const aPct = a.progress.target > 0 ? a.progress.current / a.progress.target : 0;
    const bPct = b.progress.target > 0 ? b.progress.current / b.progress.target : 0;
    return bPct - aPct;
  });
  return candidates[0];
}
