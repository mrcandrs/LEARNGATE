import type { ComponentProps } from "react";
import type { MaterialCommunityIcons } from "@expo/vector-icons";

export type AchievementIcon = ComponentProps<typeof MaterialCommunityIcons>["name"];

export type ChildAchievementStats = {
  stars: number;
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

export type AchievementDefinition = {
  id: string;
  title: string;
  description: string;
  icon: AchievementIcon;
  category: "stars" | "tasks" | "games" | "chores" | "exercise" | "streak" | "special";
  isUnlocked: (stats: ChildAchievementStats) => boolean;
  progress?: (stats: ChildAchievementStats) => { current: number; target: number };
};

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    id: "first_star",
    title: "First Star",
    description: "Earn your first star.",
    icon: "star",
    category: "stars",
    isUnlocked: (s) => s.stars > 0,
    progress: (s) => ({ current: Math.min(s.stars, 1), target: 1 }),
  },
  {
    id: "star_collector",
    title: "Star Collector",
    description: "Reach 200 total stars.",
    icon: "star-circle",
    category: "stars",
    isUnlocked: (s) => s.stars >= 200,
    progress: (s) => ({ current: Math.min(s.stars, 200), target: 200 }),
  },
  {
    id: "star_master",
    title: "Star Master",
    description: "Reach 500 total stars.",
    icon: "star-shooting",
    category: "stars",
    isUnlocked: (s) => s.stars >= 500,
    progress: (s) => ({ current: Math.min(s.stars, 500), target: 500 }),
  },
  {
    id: "first_task",
    title: "Getting Started",
    description: "Complete your first task.",
    icon: "flag-checkered",
    category: "tasks",
    isUnlocked: (s) => s.completedTasks >= 1,
    progress: (s) => ({ current: Math.min(s.completedTasks, 1), target: 1 }),
  },
  {
    id: "task_finisher",
    title: "Task Finisher",
    description: "Complete 10 tasks.",
    icon: "trophy",
    category: "tasks",
    isUnlocked: (s) => s.completedTasks >= 10,
    progress: (s) => ({ current: Math.min(s.completedTasks, 10), target: 10 }),
  },
  {
    id: "learning_champ",
    title: "Learning Champ",
    description: "Complete 50 tasks.",
    icon: "book-open-page-variant",
    category: "tasks",
    isUnlocked: (s) => s.completedTasks >= 50,
    progress: (s) => ({ current: Math.min(s.completedTasks, 50), target: 50 }),
  },
  {
    id: "learning_focus",
    title: "Brain Builder",
    description: "Complete 5 learning tasks.",
    icon: "brain",
    category: "tasks",
    isUnlocked: (s) => s.completedLearning >= 5,
    progress: (s) => ({ current: Math.min(s.completedLearning, 5), target: 5 }),
  },
  {
    id: "game_starter",
    title: "Game On",
    description: "Finish your first game.",
    icon: "gamepad-variant",
    category: "games",
    isUnlocked: (s) => s.gamesCompleted >= 1,
    progress: (s) => ({ current: Math.min(s.gamesCompleted, 1), target: 1 }),
  },
  {
    id: "game_fan",
    title: "Game Fan",
    description: "Finish 10 games.",
    icon: "controller-classic",
    category: "games",
    isUnlocked: (s) => s.gamesCompleted >= 10,
    progress: (s) => ({ current: Math.min(s.gamesCompleted, 10), target: 10 }),
  },
  {
    id: "chore_helper",
    title: "Chore Helper",
    description: "Complete your first chore.",
    icon: "broom",
    category: "chores",
    isUnlocked: (s) => s.completedChores >= 1,
    progress: (s) => ({ current: Math.min(s.completedChores, 1), target: 1 }),
  },
  {
    id: "photo_pro",
    title: "Photo Pro",
    description: "Submit a chore photo for review.",
    icon: "camera",
    category: "chores",
    isUnlocked: (s) => s.choreSubmissions >= 1,
    progress: (s) => ({ current: Math.min(s.choreSubmissions, 1), target: 1 }),
  },
  {
    id: "exercise_hero",
    title: "Exercise Hero",
    description: "Complete an exercise task.",
    icon: "run",
    category: "exercise",
    isUnlocked: (s) => s.completedExercise >= 1,
    progress: (s) => ({ current: Math.min(s.completedExercise, 1), target: 1 }),
  },
  {
    id: "streak_3",
    title: "On a Roll",
    description: "Stay active 3 days in a row.",
    icon: "fire",
    category: "streak",
    isUnlocked: (s) => s.dailyStreak >= 3,
    progress: (s) => ({ current: Math.min(s.dailyStreak, 3), target: 3 }),
  },
  {
    id: "streak_7",
    title: "Week Warrior",
    description: "Stay active 7 days in a row.",
    icon: "calendar-week",
    category: "streak",
    isUnlocked: (s) => s.dailyStreak >= 7,
    progress: (s) => ({ current: Math.min(s.dailyStreak, 7), target: 7 }),
  },
  {
    id: "level_rising",
    title: "Level Rising",
    description: "Reach difficulty level 5.",
    icon: "chart-line",
    category: "special",
    isUnlocked: (s) => s.difficultyLevel >= 5,
    progress: (s) => ({ current: Math.min(s.difficultyLevel, 5), target: 5 }),
  },
];
