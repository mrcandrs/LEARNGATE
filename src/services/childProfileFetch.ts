import { supabase } from "@/services/supabase";
import type { ChildProfileRow } from "@/types/child";
import { formatAppError } from "@/utils/errors";

export async function fetchChildProfileForCurrentUser(): Promise<{
  child: ChildProfileRow | null;
  error: string | null;
}> {
  if (!supabase) {
    return { child: null, error: null };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { child: null, error: formatAppError(userError ?? new Error("Not signed in.")) };
  }

  const { data, error: childError } = await supabase
    .from("children")
    .select(
      "id, name, age, difficulty_level, stars, stars_lifetime, daily_limit_minutes, screen_limit_enabled, bedtime_enabled, bedtime_start, bedtime_end, avatar_url, audio_guide_enabled, audio_guide_rate"
    )
    .eq("child_user_id", user.id)
    .maybeSingle();

  if (childError || !data) {
    return {
      child: null,
      error: childError ? formatAppError(childError) : "No child profile linked to this account.",
    };
  }

  const { data: ruleRow, error: ruleError } = await supabase
    .from("screen_rules")
    .select("blocked_apps_json")
    .eq("child_id", data.id)
    .maybeSingle();

  if (ruleError) {
    return { child: null, error: formatAppError(ruleError) };
  }

  const blocked = Array.isArray(ruleRow?.blocked_apps_json) ? ruleRow!.blocked_apps_json : [];

  const row = data as Record<string, unknown>;

  return {
    child: {
      ...(row as ChildProfileRow),
      screen_limit_enabled: row.screen_limit_enabled !== false,
      bedtime_enabled: row.bedtime_enabled !== false,
      blocked_apps_json: blocked.filter((p): p is string => typeof p === "string" && p.length > 0),
    },
    error: null,
  };
}
