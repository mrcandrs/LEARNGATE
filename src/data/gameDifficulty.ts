import { difficultyTierToLevel, type DifficultyTier } from "@/utils/difficulty";

export type { DifficultyTier };

/** Level used for bonus / free-play games (not assigned as a parent task). */
export const BONUS_PLAY_DIFFICULTY_LEVEL = 2;

export function getDifficultyTier(level: number): DifficultyTier {
  if (level <= 3) return "easy";
  if (level >= 8) return "hard";
  return "medium";
}

/** Stars awarded when the child completes an assigned learning game (perfect-score equivalent). */
export function learningTaskXpReward(tier: DifficultyTier, gameId: string): number {
  const level = difficultyTierToLevel(tier);
  const { rounds, xpPerCorrect } = getGameSettings(level, gameId);
  return rounds * xpPerCorrect;
}

export function getGameSettings(level: number, gameId: string) {
  const tier = getDifficultyTier(level);
  const baseChoices = tier === "easy" ? 3 : tier === "hard" ? 5 : 4;
  const rounds = 10;
  const numberMax = tier === "easy" ? 9 : tier === "hard" ? 20 : 14;
  const xpPerCorrect = tier === "easy" ? 8 : tier === "hard" ? 14 : 10;
  const choiceCount = gameId === "numbers" ? Math.max(3, baseChoices) : baseChoices;

  return { tier, rounds, choiceCount, numberMax, xpPerCorrect };
}
