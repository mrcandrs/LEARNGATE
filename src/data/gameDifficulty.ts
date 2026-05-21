export type DifficultyTier = "easy" | "medium" | "hard";

export function getDifficultyTier(level: number): DifficultyTier {
  if (level <= 3) return "easy";
  if (level >= 8) return "hard";
  return "medium";
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
