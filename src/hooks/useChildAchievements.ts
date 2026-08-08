import { useCallback, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  evaluateAchievementLadders,
  evaluateAchievements,
  fetchChildAchievementStats,
  getNextLockedTier,
  groupLaddersByCategory,
  type AchievementCategoryGroup,
  type AchievementLadderProgress,
  type AchievementProgress,
  type ChildAchievementStats,
  type LadderTierProgress,
} from "@/services/childAchievements";
import { claimAchievementReward, loadClaimedAchievementIds } from "@/services/achievementClaims";

const seenKey = (childId: string) => `learngate_achievements_seen_${childId}`;

export function useChildAchievements(
  child: { id: string; stars: number; stars_lifetime?: number; difficulty_level: number } | null | undefined,
) {
  const [stats, setStats] = useState<ChildAchievementStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [newUnlockTitle, setNewUnlockTitle] = useState<string | null>(null);
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set());
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimCelebration, setClaimCelebration] = useState<{ stars: number } | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  const progress = useMemo(() => (stats ? evaluateAchievements(stats) : []), [stats]);
  const ladderProgress = useMemo(() => (stats ? evaluateAchievementLadders(stats) : []), [stats]);
  const ladderGroups = useMemo(() => groupLaddersByCategory(ladderProgress), [ladderProgress]);
  const unlockedCount = useMemo(() => progress.filter((p) => p.unlocked).length, [progress]);
  const nextUp = useMemo(() => getNextLockedTier(ladderProgress), [ladderProgress]);

  const refresh = useCallback(async (silent = false) => {
    if (!child) {
      setStats(null);
      setClaimedIds(new Set());
      setLoading(false);
      return;
    }
    if (!silent) {
      setLoading(true);
    }
    const [nextStats, claimed] = await Promise.all([
      fetchChildAchievementStats(child),
      loadClaimedAchievementIds(child.id),
    ]);
    setStats(nextStats);
    setClaimedIds(claimed);
    const nextProgress = evaluateAchievements(nextStats);
    const unlockedIds = nextProgress.filter((p) => p.unlocked).map((p) => p.definition.id);

    if (!silent) {
      try {
        const raw = await AsyncStorage.getItem(seenKey(child.id));
        const seen: string[] = raw ? (JSON.parse(raw) as string[]) : [];
        const brandNew = unlockedIds.filter((id) => !seen.includes(id));
        if (brandNew.length > 0) {
          const first = nextProgress.find((p) => p.definition.id === brandNew[0]);
          if (first) {
            setNewUnlockTitle(first.definition.title);
          }
          await AsyncStorage.setItem(seenKey(child.id), JSON.stringify(unlockedIds));
        }
      } catch {
        // non-fatal
      }
    }

    setLoading(false);
  }, [child]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const clearNewUnlock = useCallback(() => setNewUnlockTitle(null), []);
  const clearClaimCelebration = useCallback(() => setClaimCelebration(null), []);
  const clearClaimError = useCallback(() => setClaimError(null), []);

  const claimAchievement = useCallback(
    async (achievementId: string, onStarsAwarded?: () => void) => {
      if (!child) {
        return;
      }
      setClaimingId(achievementId);
      const result = await claimAchievementReward({ childId: child.id, achievementId });
      setClaimingId(null);
      if (result.ok) {
        setClaimedIds((prev) => new Set([...prev, achievementId]));
        const bonus = result.stars ?? 0;
        setStats((prev) =>
          prev
            ? {
                ...prev,
                stars: prev.stars + bonus,
                starsThisWeek: prev.starsThisWeek + bonus,
              }
            : prev
        );
        setClaimCelebration({ stars: bonus > 0 ? bonus : 0 });
        onStarsAwarded?.();
        void refresh(true);
      } else {
        setClaimError(result.message);
      }
    },
    [child, refresh]
  );

  const isClaimed = useCallback((achievementId: string) => claimedIds.has(achievementId), [claimedIds]);

  return {
    stats,
    progress,
    ladderProgress,
    ladderGroups,
    unlockedCount,
    totalCount: progress.length,
    nextUp,
    loading,
    refresh,
    newUnlockTitle,
    clearNewUnlock,
    claimAchievement,
    claimingId,
    claimCelebration,
    clearClaimCelebration,
    claimError,
    clearClaimError,
    isClaimed,
  };
}

export type { AchievementProgress, AchievementCategoryGroup, AchievementLadderProgress, LadderTierProgress };
