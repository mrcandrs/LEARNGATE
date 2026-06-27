import { useCallback, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  evaluateAchievements,
  fetchChildAchievementStats,
  getNextLockedAchievement,
  type AchievementProgress,
  type ChildAchievementStats,
} from "@/services/childAchievements";
import { claimAchievementReward, loadClaimedAchievementIds } from "@/services/achievementClaims";

const seenKey = (childId: string) => `learngate_achievements_seen_${childId}`;

export function useChildAchievements(
  child: { id: string; stars: number; difficulty_level: number } | null | undefined,
) {
  const [stats, setStats] = useState<ChildAchievementStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [newUnlockTitle, setNewUnlockTitle] = useState<string | null>(null);
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set());
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);

  const progress = useMemo(() => (stats ? evaluateAchievements(stats) : []), [stats]);
  const unlockedCount = useMemo(() => progress.filter((p) => p.unlocked).length, [progress]);
  const nextUp = useMemo(() => getNextLockedAchievement(progress), [progress]);

  const refresh = useCallback(async () => {
    if (!child) {
      setStats(null);
      setClaimedIds(new Set());
      setLoading(false);
      return;
    }
    setLoading(true);
    const [nextStats, claimed] = await Promise.all([
      fetchChildAchievementStats(child),
      loadClaimedAchievementIds(child.id),
    ]);
    setStats(nextStats);
    setClaimedIds(claimed);
    const nextProgress = evaluateAchievements(nextStats);
    const unlockedIds = nextProgress.filter((p) => p.unlocked).map((p) => p.definition.id);

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

    setLoading(false);
  }, [child]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const clearNewUnlock = useCallback(() => setNewUnlockTitle(null), []);

  const claimAchievement = useCallback(
    async (achievementId: string, onStarsAwarded?: () => void) => {
      if (!child) {
        return;
      }
      setClaimingId(achievementId);
      setClaimMessage(null);
      const result = await claimAchievementReward({ childId: child.id, achievementId });
      setClaimingId(null);
      if (result.ok) {
        setClaimedIds((prev) => new Set([...prev, achievementId]));
        setClaimMessage(result.message);
        onStarsAwarded?.();
        await refresh();
      } else {
        setClaimMessage(result.message);
      }
    },
    [child, refresh]
  );

  const isClaimed = useCallback((achievementId: string) => claimedIds.has(achievementId), [claimedIds]);

  return {
    stats,
    progress,
    unlockedCount,
    totalCount: progress.length,
    nextUp,
    loading,
    refresh,
    newUnlockTitle,
    clearNewUnlock,
    claimAchievement,
    claimingId,
    claimMessage,
    clearClaimMessage: () => setClaimMessage(null),
    isClaimed,
  };
}

export type { AchievementProgress };
