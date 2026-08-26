import { type DifficultyTier } from "@/utils/difficulty";

export type { DifficultyTier };

/** Level used for bonus / free-play games (not assigned as a parent task). */
export const BONUS_PLAY_DIFFICULTY_LEVEL = 2;

export function getDifficultyTier(level: number): DifficultyTier {
  if (level <= 3) return "easy";
  if (level >= 8) return "hard";
  return "medium";
}

/** Stars awarded when the child completes an assigned learning game. */
export function learningTaskXpReward(tier: DifficultyTier, _gameId: string): number {
  // Flat task rewards — not full free-play score — so assigned games stay fair vs chores/exercise.
  if (tier === "easy") return 10;
  if (tier === "hard") return 20;
  return 15;
}

export function getGameSettings(level: number, gameId: string) {
  const tier = getDifficultyTier(level);
  const baseChoices = tier === "easy" ? 3 : tier === "hard" ? 5 : 4;
  const rounds = 10;
  const numberMax = tier === "easy" ? 9 : tier === "hard" ? 20 : 14;
  const xpPerCorrect = tier === "easy" ? 1 : tier === "hard" ? 3 : 2;
  const choiceCount = gameId === "numbers" ? Math.max(3, baseChoices) : baseChoices;

  return { tier, rounds, choiceCount, numberMax, xpPerCorrect };
}
