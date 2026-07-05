import type { ComponentProps } from "react";
import type { MaterialCommunityIcons } from "@expo/vector-icons";

export type AchievementIcon = ComponentProps<typeof MaterialCommunityIcons>["name"];

export type AchievementCategory =
  | "stars"
  | "tasks"
  | "learning"
  | "games"
  | "chores"
  | "exercise"
  | "streak"
  | "special";

export const ACHIEVEMENT_CATEGORY_ORDER: AchievementCategory[] = [
  "stars",
  "tasks",
  "learning",
  "games",
  "chores",
  "exercise",
  "streak",
  "special",
];

export const ACHIEVEMENT_CATEGORY_LABELS: Record<AchievementCategory, string> = {
  stars: "Star Milestones",
  tasks: "Task Hero",
  learning: "Brain Builder",
  games: "Game Master",
  chores: "Chore Champion",
  exercise: "Move & Groove",
  streak: "Daily Streak",
  special: "Level Up",
};

export type ChildAchievementStats = {
  /** Lifetime stars (never reset weekly). */
  stars: number;
  /** Current week star balance. */
  starsThisWeek: number;
  difficultyLevel: number;
  completedTasks: number;
  completedLearning: number;
  completedExercise: number;
  completedChores: number;
  gamesCompleted: number;
  choreSubmissions: number;
  dailyStreak: number;
  activeDaysLast14: number;
};

export type AchievementLadderTier = {
  id: string;
  /** Short label on the step bar (e.g. "200", "7d"). */
  stepLabel: string;
  target: number;
  bonusStars: number;
};

export type AchievementLadder = {
  id: string;
  title: string;
  description: string;
  icon: AchievementIcon;
  category: AchievementCategory;
  getValue: (stats: ChildAchievementStats) => number;
  /** How to show the current value under the bar. */
  formatValue?: (value: number) => string;
  tiers: AchievementLadderTier[];
};

/** One flat achievement per ladder step — used for unlock checks and claim rewards. */
export type AchievementDefinition = {
  id: string;
  title: string;
  description: string;
  icon: AchievementIcon;
  bonusStars: number;
  category: AchievementCategory;
  ladderId: string;
  stepLabel: string;
  isUnlocked: (stats: ChildAchievementStats) => boolean;
  progress: (stats: ChildAchievementStats) => { current: number; target: number };
};

function tierId(ladderId: string, target: number): string {
  return `${ladderId}_t${target}`;
}

function bonusForTier(base: number, index: number): number {
  return base + Math.floor(index / 2) * 5;
}

export const ACHIEVEMENT_LADDERS: AchievementLadder[] = [
  {
    id: "lifetime_stars",
    title: "Star Collector",
    description: "Earn lifetime stars across all activities. Each step unlocks bonus stars.",
    icon: "star-shooting",
    category: "stars",
    getValue: (s) => s.stars,
    formatValue: (v) => `${v} stars`,
    tiers: [
      { id: tierId("lifetime_stars", 1), stepLabel: "1", target: 1, bonusStars: 5 },
      { id: tierId("lifetime_stars", 25), stepLabel: "25", target: 25, bonusStars: 8 },
      { id: tierId("lifetime_stars", 50), stepLabel: "50", target: 50, bonusStars: 10 },
      { id: tierId("lifetime_stars", 100), stepLabel: "100", target: 100, bonusStars: 12 },
      { id: tierId("lifetime_stars", 200), stepLabel: "200", target: 200, bonusStars: 15 },
      { id: tierId("lifetime_stars", 350), stepLabel: "350", target: 350, bonusStars: 18 },
      { id: tierId("lifetime_stars", 500), stepLabel: "500", target: 500, bonusStars: 20 },
      { id: tierId("lifetime_stars", 750), stepLabel: "750", target: 750, bonusStars: 25 },
      { id: tierId("lifetime_stars", 1000), stepLabel: "1K", target: 1000, bonusStars: 30 },
      { id: tierId("lifetime_stars", 1500), stepLabel: "1.5K", target: 1500, bonusStars: 40 },
      { id: tierId("lifetime_stars", 2000), stepLabel: "2K", target: 2000, bonusStars: 50 },
    ],
  },
  {
    id: "weekly_stars",
    title: "Weekly Star Rush",
    description: "Stack stars during the current week before Monday reset.",
    icon: "star-circle",
    category: "stars",
    getValue: (s) => s.starsThisWeek,
    formatValue: (v) => `${v} this week`,
    tiers: [
      { id: tierId("weekly_stars", 10), stepLabel: "10", target: 10, bonusStars: 5 },
      { id: tierId("weekly_stars", 25), stepLabel: "25", target: 25, bonusStars: 8 },
      { id: tierId("weekly_stars", 50), stepLabel: "50", target: 50, bonusStars: 10 },
      { id: tierId("weekly_stars", 100), stepLabel: "100", target: 100, bonusStars: 15 },
      { id: tierId("weekly_stars", 200), stepLabel: "200", target: 200, bonusStars: 20 },
    ],
  },
  {
    id: "tasks_completed",
    title: "Task Finisher",
    description: "Complete any mix of learning, exercise, and chore tasks.",
    icon: "flag-checkered",
    category: "tasks",
    getValue: (s) => s.completedTasks,
    formatValue: (v) => `${v} tasks`,
    tiers: [1, 5, 10, 25, 50, 100, 200].map((target, i) => ({
      id: tierId("tasks_completed", target),
      stepLabel: String(target),
      target,
      bonusStars: bonusForTier(5, i),
    })),
  },
  {
    id: "learning_tasks",
    title: "Learning Path",
    description: "Finish assigned learning games and study tasks.",
    icon: "brain",
    category: "learning",
    getValue: (s) => s.completedLearning,
    formatValue: (v) => `${v} learning`,
    tiers: [1, 5, 15, 30, 50, 100].map((target, i) => ({
      id: tierId("learning_tasks", target),
      stepLabel: String(target),
      target,
      bonusStars: bonusForTier(5, i),
    })),
  },
  {
    id: "games_played",
    title: "Game Master",
    description: "Play and finish learning games from Activities.",
    icon: "gamepad-variant",
    category: "games",
    getValue: (s) => s.gamesCompleted,
    formatValue: (v) => `${v} games`,
    tiers: [1, 5, 10, 25, 50, 100].map((target, i) => ({
      id: tierId("games_played", target),
      stepLabel: String(target),
      target,
      bonusStars: bonusForTier(5, i),
    })),
  },
  {
    id: "chores_done",
    title: "Chore Champion",
    description: "Complete household chores assigned by your parent.",
    icon: "broom",
    category: "chores",
    getValue: (s) => s.completedChores,
    formatValue: (v) => `${v} chores`,
    tiers: [1, 5, 10, 25, 50].map((target, i) => ({
      id: tierId("chores_done", target),
      stepLabel: String(target),
      target,
      bonusStars: bonusForTier(5, i),
    })),
  },
  {
    id: "chore_photos",
    title: "Photo Pro",
    description: "Submit chore photos for parent review.",
    icon: "camera",
    category: "chores",
    getValue: (s) => s.choreSubmissions,
    formatValue: (v) => `${v} photos`,
    tiers: [1, 5, 10, 25].map((target, i) => ({
      id: tierId("chore_photos", target),
      stepLabel: String(target),
      target,
      bonusStars: bonusForTier(8, i),
    })),
  },
  {
    id: "exercise_done",
    title: "Exercise Hero",
    description: "Complete movement and exercise tasks.",
    icon: "run",
    category: "exercise",
    getValue: (s) => s.completedExercise,
    formatValue: (v) => `${v} sessions`,
    tiers: [1, 5, 10, 25, 50].map((target, i) => ({
      id: tierId("exercise_done", target),
      stepLabel: String(target),
      target,
      bonusStars: bonusForTier(8, i),
    })),
  },
  {
    id: "daily_streak",
    title: "On a Roll",
    description: "Stay active on consecutive days.",
    icon: "fire",
    category: "streak",
    getValue: (s) => s.dailyStreak,
    formatValue: (v) => `${v} days`,
    tiers: [
      { id: tierId("daily_streak", 3), stepLabel: "3d", target: 3, bonusStars: 10 },
      { id: tierId("daily_streak", 7), stepLabel: "7d", target: 7, bonusStars: 15 },
      { id: tierId("daily_streak", 14), stepLabel: "14d", target: 14, bonusStars: 20 },
      { id: tierId("daily_streak", 30), stepLabel: "30d", target: 30, bonusStars: 35 },
    ],
  },
  {
    id: "active_days",
    title: "Busy Bee",
    description: "Be active on different days in the last two weeks.",
    icon: "calendar-check",
    category: "streak",
    getValue: (s) => s.activeDaysLast14,
    formatValue: (v) => `${v} / 14 days`,
    tiers: [3, 7, 10, 14].map((target, i) => ({
      id: tierId("active_days", target),
      stepLabel: String(target),
      target,
      bonusStars: bonusForTier(8, i),
    })),
  },
  {
    id: "difficulty_level",
    title: "Level Rising",
    description: "Reach higher difficulty set by your parent.",
    icon: "chart-line",
    category: "special",
    getValue: (s) => s.difficultyLevel,
    formatValue: (v) => `Level ${v}`,
    tiers: [3, 5, 7, 10].map((target, i) => ({
      id: tierId("difficulty_level", target),
      stepLabel: `L${target}`,
      target,
      bonusStars: bonusForTier(10, i),
    })),
  },
];

function ladderTierToDefinition(ladder: AchievementLadder, tier: AchievementLadderTier): AchievementDefinition {
  return {
    id: tier.id,
    title: `${ladder.title} · ${tier.stepLabel}`,
    description: `Reach ${tier.target}${ladder.category === "streak" ? " days" : ""} on ${ladder.title.toLowerCase()}.`,
    icon: ladder.icon,
    bonusStars: tier.bonusStars,
    category: ladder.category,
    ladderId: ladder.id,
    stepLabel: tier.stepLabel,
    isUnlocked: (stats) => ladder.getValue(stats) >= tier.target,
    progress: (stats) => ({
      current: Math.min(ladder.getValue(stats), tier.target),
      target: tier.target,
    }),
  };
}

/** Flat list of every ladder step (for claims and unlock tracking). */
export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = ACHIEVEMENT_LADDERS.flatMap((ladder) =>
  ladder.tiers.map((tier) => ladderTierToDefinition(ladder, tier))
);

export function getAchievementBonusStars(achievementId: string): number {
  return ACHIEVEMENT_DEFINITIONS.find((a) => a.id === achievementId)?.bonusStars ?? 0;
}

export function getLadderById(ladderId: string): AchievementLadder | undefined {
  return ACHIEVEMENT_LADDERS.find((l) => l.id === ladderId);
}
