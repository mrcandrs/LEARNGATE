import { supabase } from "@/services/supabase";

export type WeeklyStarSnapshot = {
  child_id: string;
  week_start: string;
  week_end: string;
  stars_at_reset: number;
  points_earned: number;
  tasks_completed: number;
  completions_by_category: { learning: number; exercise: number; chore: number };
  app_time_seconds: number;
};

const SNAPSHOT_SELECT =
  "child_id, week_start, week_end, stars_at_reset, points_earned, tasks_completed, completions_by_category, app_time_seconds";

function rowToSnapshot(row: Record<string, unknown>): WeeklyStarSnapshot {
  const cat = row.completions_by_category as Record<string, number> | null;
  return {
    child_id: row.child_id as string,
    week_start: row.week_start as string,
    week_end: row.week_end as string,
    stars_at_reset: (row.stars_at_reset as number) ?? 0,
    points_earned: (row.points_earned as number) ?? 0,
    tasks_completed: (row.tasks_completed as number) ?? 0,
    completions_by_category: {
      learning: cat?.learning ?? 0,
      exercise: cat?.exercise ?? 0,
      chore: cat?.chore ?? 0,
    },
    app_time_seconds: (row.app_time_seconds as number) ?? 0,
  };
}

/** Format stored week_start / week_end (Manila calendar dates) for display. */
export function formatWeekRangeLabel(weekStart: string, weekEnd: string): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };
  return `${fmt(weekStart)} – ${fmt(weekEnd)}`;
}

/** Closed weeks newest first (default 12 weeks). */
export async function fetchWeeklyStarHistory(
  childId: string,
  limit = 12
): Promise<WeeklyStarSnapshot[]> {
  if (!supabase || !childId) {
    return [];
  }

  const { data, error } = await supabase
    .from("child_weekly_star_snapshots")
    .select(SNAPSHOT_SELECT)
    .eq("child_id", childId)
    .order("week_start", { ascending: false })
    .limit(limit);

  if (error) {
    if (__DEV__) {
      console.warn("[weeklyStars] history:", error.message);
    }
    return [];
  }

  return (data ?? []).map((row) => rowToSnapshot(row as Record<string, unknown>));
}

/** Latest closed-week snapshot per child (for parent dashboard). */
export async function fetchLatestWeeklySnapshots(
  childIds: string[]
): Promise<Record<string, WeeklyStarSnapshot>> {
  if (!supabase || childIds.length === 0) {
    return {};
  }

  const { data, error } = await supabase
    .from("child_weekly_star_snapshots")
    .select(SNAPSHOT_SELECT)
    .in("child_id", childIds)
    .order("week_start", { ascending: false });

  if (error) {
    if (__DEV__) {
      console.warn("[weeklyStars] fetch:", error.message);
    }
    return {};
  }

  const byChild: Record<string, WeeklyStarSnapshot> = {};
  for (const row of data ?? []) {
    const snap = rowToSnapshot(row as Record<string, unknown>);
    if (!byChild[snap.child_id]) {
      byChild[snap.child_id] = snap;
    }
  }

  return byChild;
}
