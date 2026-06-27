import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/services/supabase";
import { formatAppError } from "@/utils/errors";
import { getAchievementBonusStars } from "@/data/achievements";

const claimedKey = (childId: string) => `learngate_achievements_claimed_${childId}`;

export async function loadClaimedAchievementIds(childId: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(claimedKey(childId));
    const ids: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(ids);
  } catch {
    return new Set();
  }
}

export async function saveClaimedAchievementIds(childId: string, ids: Set<string>): Promise<void> {
  await AsyncStorage.setItem(claimedKey(childId), JSON.stringify([...ids]));
}

export async function claimAchievementReward(params: {
  childId: string;
  achievementId: string;
}): Promise<{ ok: boolean; message: string; stars?: number }> {
  const bonus = getAchievementBonusStars(params.achievementId);
  if (bonus <= 0) {
    return { ok: false, message: "This achievement has no claimable reward." };
  }

  const claimed = await loadClaimedAchievementIds(params.childId);
  if (claimed.has(params.achievementId)) {
    return { ok: false, message: "Reward already claimed." };
  }

  if (!supabase) {
    return { ok: false, message: "Supabase is not configured." };
  }

  const { error } = await supabase.rpc("award_child_points", {
    p_child_id: params.childId,
    p_points: bonus,
    p_event_type: "achievement_claim",
    p_metadata: { achievement_id: params.achievementId, bonus_stars: bonus },
  });

  if (error) {
    return { ok: false, message: formatAppError(error) };
  }

  claimed.add(params.achievementId);
  await saveClaimedAchievementIds(params.childId, claimed);

  return { ok: true, message: `+${bonus} stars claimed!`, stars: bonus };
}
