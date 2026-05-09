export type DifficultyTier = "easy" | "medium" | "hard";

export function levelToDifficultyTier(level: number): DifficultyTier {
  if (level <= 3) return "easy";
  if (level >= 8) return "hard";
  return "medium";
}

export function difficultyTierLabel(tier: DifficultyTier): string {
  if (tier === "easy") return "Easy";
  if (tier === "hard") return "Hard";
  return "Medium";
}

export function levelToDifficultyLabel(level: number): string {
  return difficultyTierLabel(levelToDifficultyTier(level));
}

export function difficultyTierToLevel(tier: DifficultyTier): number {
  if (tier === "easy") return 2;
  if (tier === "hard") return 9;
  return 5;
}

