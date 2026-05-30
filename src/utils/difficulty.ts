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

/** Synced to screen_rules.reward_multiplier from the child's difficulty tier. */
export function rewardMultiplierForDifficultyLevel(level: number): number {
  const tier = levelToDifficultyTier(level);
  if (tier === "easy") return 1;
  if (tier === "hard") return 1.5;
  return 1.25;
}

export function formatRewardMultiplier(level: number): string {
  const value = rewardMultiplierForDifficultyLevel(level);
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

