/// <reference path="../deno-shim.d.ts" />
/**
 * Generates a parent coaching insight for one child using Google Gemini (free tier).
 * Uses gemini-2.5-flash-lite with fallbacks if a model is retired.
 *
 * POST { "child_id": "uuid", "force": false, "notify": false }
 * Authorization: Bearer <parent JWT>
 *
 * Deploy: npx supabase functions deploy generate-parent-insight
 * Secrets: npx supabase secrets set GEMINI_API_KEY=your-key-from-aistudio.google.com
 *
 * Pass force: true to skip cache and always call Gemini (app does this on View More).
 */
// @ts-expect-error Deno resolves npm: specifiers at deploy time
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";

// gemini-1.5-flash was shut down in 2026; use a current stable model on the free tier.
const GEMINI_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-3.1-flash-lite"] as const;
const DEFAULT_CACHE_MS = 24 * 60 * 60 * 1000;
const CACHE_MS = Number(Deno.env.get("PARENT_INSIGHT_CACHE_MS") ?? DEFAULT_CACHE_MS);

type InsightPayload = {
  summary: string;
  latest_task_line: string;
  focus_areas: string;
  recommendation: string;
  next_best_step: string;
};

type TaskRow = {
  title: string;
  category: string;
  status: string;
  created_at: string;
  completed_at: string | null;
};

type UsageRow = {
  app_label: string | null;
  package_name: string;
  duration_seconds: number | null;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function clamp(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function parseInsightJson(raw: string): InsightPayload | null {
  try {
    const parsed = JSON.parse(raw) as Partial<InsightPayload>;
    if (
      typeof parsed.summary !== "string" ||
      typeof parsed.latest_task_line !== "string" ||
      typeof parsed.focus_areas !== "string" ||
      typeof parsed.recommendation !== "string" ||
      typeof parsed.next_best_step !== "string"
    ) {
      return null;
    }
    return {
      summary: clamp(parsed.summary, 280),
      latest_task_line: clamp(parsed.latest_task_line, 160),
      focus_areas: clamp(parsed.focus_areas, 220),
      recommendation: clamp(parsed.recommendation, 320),
      next_best_step: clamp(parsed.next_best_step, 220),
    };
  } catch {
    return null;
  }
}

type WeeklySnapshotRow = {
  week_start: string;
  week_end: string;
  stars_at_reset: number;
  points_earned: number;
  tasks_completed: number;
  completions_by_category: { learning?: number; exercise?: number; chore?: number };
  app_time_seconds: number;
};

function buildContext(params: {
  childName: string;
  age: number | null;
  starsThisWeek: number;
  starsLifetime: number;
  pointsEarnedThisWeek: number;
  dailyLimitMinutes: number;
  difficultyLevel: number;
  isOnline: boolean;
  tasks: TaskRow[];
  pendingReviews: number;
  appTimeSeconds: number;
  topApps: { label: string; minutes: number }[];
  lastWeekSnapshot: WeeklySnapshotRow | null;
}) {
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const completedWeek = params.tasks.filter(
    (t) =>
      t.status === "completed" &&
      t.completed_at &&
      now - new Date(t.completed_at).getTime() <= weekMs,
  );
  const activeCount = params.tasks.filter((t) =>
    ["pending", "in_progress", "submitted"].includes(t.status)
  ).length;

  const byCategory = { learning: 0, exercise: 0, chore: 0 };
  for (const t of completedWeek) {
    if (t.category in byCategory) {
      byCategory[t.category as keyof typeof byCategory] += 1;
    }
  }

  const latestCompleted = [...params.tasks]
    .filter((t) => t.status === "completed" && t.completed_at)
    .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())[0];

  const learningTitles = completedWeek
    .filter((t) => t.category === "learning")
    .map((t) => t.title.toLowerCase());

  return {
    child_name: params.childName,
    age: params.age,
    stars_this_week: params.starsThisWeek,
    stars_lifetime: params.starsLifetime,
    points_earned_this_week: params.pointsEarnedThisWeek,
    daily_screen_limit_minutes: params.dailyLimitMinutes,
    difficulty_level: params.difficultyLevel,
    is_online_now: params.isOnline,
    completions_this_week: completedWeek.length,
    completions_by_category: byCategory,
    active_task_count: activeCount,
    pending_reviews: params.pendingReviews,
    app_time_minutes_this_week: Math.round(params.appTimeSeconds / 60),
    top_apps_this_week: params.topApps,
    latest_completed_task: latestCompleted
      ? { title: latestCompleted.title, category: latestCompleted.category }
      : null,
    learning_subjects_this_week: {
      math: learningTitles.some((t) => t.includes("math") || t.includes("number")),
      reading: learningTitles.some((t) => t.includes("alphabet") || t.includes("read")),
      science: learningTitles.some((t) => t.includes("science")),
    },
    last_week: params.lastWeekSnapshot
      ? {
          week_start: params.lastWeekSnapshot.week_start,
          week_end: params.lastWeekSnapshot.week_end,
          stars_earned: params.lastWeekSnapshot.stars_at_reset,
          points_earned: params.lastWeekSnapshot.points_earned,
          tasks_completed: params.lastWeekSnapshot.tasks_completed,
          completions_by_category: params.lastWeekSnapshot.completions_by_category,
          app_time_minutes: Math.round(params.lastWeekSnapshot.app_time_seconds / 60),
        }
      : null,
  };
}

async function loadContext(supabase: SupabaseClient, childId: string, parentId: string) {
  const { data: child, error: childError } = await supabase
    .from("children")
    .select("id, name, age, stars, stars_lifetime, daily_limit_minutes, difficulty_level, is_online, parent_id")
    .eq("id", childId)
    .maybeSingle();

  if (childError || !child || child.parent_id !== parentId) {
    return { error: "Child not found" as const };
  }

  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [tasksRes, subsRes, usageRes, pointsRes, snapshotRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("title, category, status, created_at, completed_at")
      .eq("child_id", childId)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase.from("task_submissions").select("id").eq("child_id", childId).eq("status", "submitted"),
    supabase
      .from("child_app_usage_events")
      .select("app_label, package_name, duration_seconds")
      .eq("child_id", childId)
      .eq("event_type", "foreground")
      .gte("event_at", weekStart),
    supabase
      .from("activity_logs")
      .select("points")
      .eq("child_id", childId)
      .gte("created_at", weekStart)
      .neq("type", "weekly_star_reset"),
    supabase
      .from("child_weekly_star_snapshots")
      .select(
        "week_start, week_end, stars_at_reset, points_earned, tasks_completed, completions_by_category, app_time_seconds",
      )
      .eq("child_id", childId)
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const tasks = (tasksRes.data ?? []) as TaskRow[];
  const usageRows = (usageRes.data ?? []) as UsageRow[];
  const pointsEarnedThisWeek = (pointsRes.data ?? []).reduce(
    (sum, row) => sum + ((row.points as number) ?? 0),
    0,
  );
  const lastWeekSnapshot = (snapshotRes.data ?? null) as WeeklySnapshotRow | null;

  const appMinutes = new Map<string, number>();
  for (const row of usageRows) {
    const label = (row.app_label?.trim() || row.package_name).slice(0, 40);
    const mins = Math.round((row.duration_seconds ?? 0) / 60);
    if (mins <= 0) continue;
    appMinutes.set(label, (appMinutes.get(label) ?? 0) + mins);
  }
  const topApps = [...appMinutes.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, minutes]) => ({ label, minutes }));

  const context = buildContext({
    childName: (child.name as string) ?? "Child",
    age: typeof child.age === "number" ? child.age : null,
    starsThisWeek: (child.stars as number) ?? 0,
    starsLifetime: (child.stars_lifetime as number) ?? (child.stars as number) ?? 0,
    pointsEarnedThisWeek,
    dailyLimitMinutes: (child.daily_limit_minutes as number) ?? 0,
    difficultyLevel: (child.difficulty_level as number) ?? 1,
    isOnline: Boolean(child.is_online),
    tasks,
    pendingReviews: subsRes.data?.length ?? 0,
    appTimeSeconds: usageRows.reduce((sum, r) => sum + (r.duration_seconds ?? 0), 0),
    topApps,
    lastWeekSnapshot,
  });

  return { child, context };
}

async function callGeminiModel(
  apiKey: string,
  model: string,
  prompt: string,
): Promise<
  | { ok: true; insight: InsightPayload; model: string }
  | { ok: false; status: number; detail: string; notFound: boolean }
> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.6,
          responseMimeType: "application/json",
        },
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, status: 0, detail: `Could not reach Gemini API: ${msg}`, notFound: false };
  }

  if (!res.ok) {
    const errText = await res.text();
    console.error("Gemini error:", model, res.status, errText);
    let detail = errText.slice(0, 240);
    try {
      const parsed = JSON.parse(errText) as { error?: { message?: string } };
      if (parsed.error?.message) detail = parsed.error.message;
    } catch {
      /* use raw slice */
    }
    const notFound = res.status === 404 || /not found/i.test(detail);
    return { ok: false, status: res.status, detail, notFound };
  }

  const body = await res.json();
  const blockReason = body?.candidates?.[0]?.finishReason;
  const content = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof content !== "string") {
    return {
      ok: false,
      status: 200,
      detail: blockReason
        ? `Gemini blocked the response (${blockReason})`
        : "Gemini returned an empty response",
      notFound: false,
    };
  }

  const parsed = parseInsightJson(content);
  if (!parsed) {
    return { ok: false, status: 200, detail: "Gemini returned JSON in an unexpected format", notFound: false };
  }
  return { ok: true, insight: parsed, model };
}

async function callGemini(
  context: Record<string, unknown>,
): Promise<{ insight: InsightPayload; model: string } | { error: string }> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return {
      error:
        "GEMINI_API_KEY is not set. Run: npx supabase secrets set GEMINI_API_KEY=your-key-from-aistudio.google.com",
    };
  }

  const prompt = `You are a supportive parenting coach for LearnGate, a family app that helps children complete learning tasks, exercise, and chores.

Write a brief, personalized insight for the parent based ONLY on the JSON context below. Stars reset every Monday at midnight Asia/Manila time (stars_this_week is the current week balance; last_week has the prior closed week if available). Be specific and actionable. Do not shame the child or parent. Do not give medical or mental-health diagnoses. Use warm, practical language.

Return JSON only with these exact keys:
- summary (1-2 sentences on overall week)
- latest_task_line (one sentence about latest completion, or say none yet)
- focus_areas (one sentence on strengths or areas to improve)
- recommendation (1-2 sentences of coaching advice)
- next_best_step (start with "Next best step:" and give one concrete action)

Context JSON:
${JSON.stringify(context)}`;

  let lastError = "Gemini request failed";
  for (const model of GEMINI_MODELS) {
    const result = await callGeminiModel(apiKey, model, prompt);
    if (result.ok) {
      return { insight: result.insight, model: result.model };
    }
    lastError = result.detail;
    if (result.notFound) {
      continue;
    }
    return { error: `Gemini API error (${result.status || "network"}): ${result.detail}` };
  }

  return {
    error: `No Gemini model available. Last error: ${lastError}. Check your API key at aistudio.google.com.`,
  };
}

async function maybeEnqueueNotification(
  supabase: SupabaseClient,
  childId: string,
  parentId: string,
  insight: InsightPayload,
) {
  const body = `${insight.recommendation} ${insight.next_best_step}`.trim().slice(0, 500);
  await supabase.from("notification_outbox").insert({
    event_type: "parent_insight",
    payload: { child_id: childId, parent_id: parentId, body },
  });
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        },
      });
    }

    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized — sign in again as parent" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return jsonResponse({ error: "Missing Supabase env" }, 500);
    }

    let body: { child_id?: string; force?: boolean; notify?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const childId = body.child_id;
    if (!childId) {
      return jsonResponse({ error: "child_id is required" }, 400);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse(
        { error: userError?.message ?? "Unauthorized — sign in again as parent" },
        401,
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);

    if (!body.force) {
      const { data: cached, error: cacheError } = await admin
        .from("parent_child_insights")
        .select("*")
        .eq("child_id", childId)
        .eq("parent_id", user.id)
        .maybeSingle();

      if (cacheError) {
        console.error("Cache read error:", cacheError.message);
        if (/parent_child_insights|schema cache|does not exist/i.test(cacheError.message)) {
          return jsonResponse(
            {
              error:
                "Table parent_child_insights is missing. Run supabase/step-aa-parent-child-insights.sql in the SQL Editor.",
            },
            503,
          );
        }
      }

      if (cached?.generated_at) {
        const age = Date.now() - new Date(cached.generated_at as string).getTime();
        if (age < CACHE_MS) {
          return jsonResponse({ insight: cached, cached: true });
        }
      }
    }

    const loaded = await loadContext(admin, childId, user.id);
    if ("error" in loaded) {
      return jsonResponse({ error: loaded.error }, 404);
    }

    const gemini = await callGemini(loaded.context);
    if ("error" in gemini) {
      return jsonResponse({ error: gemini.error }, 502);
    }
    const generated = gemini.insight;

    const row = {
      child_id: childId,
      parent_id: user.id,
      summary: generated.summary,
      latest_task_line: generated.latest_task_line,
      focus_areas: generated.focus_areas,
      recommendation: generated.recommendation,
      next_best_step: generated.next_best_step,
      context_snapshot: loaded.context,
      model: gemini.model,
      generated_at: new Date().toISOString(),
    };

    const { data: saved, error: saveError } = await admin
      .from("parent_child_insights")
      .upsert(row, { onConflict: "child_id" })
      .select()
      .single();

    if (saveError) {
      console.error("Save insight error:", saveError.message);
      const hint = /parent_child_insights|does not exist/i.test(saveError.message)
        ? " Run supabase/step-aa-parent-child-insights.sql in the SQL Editor."
        : "";
      return jsonResponse({ error: `Could not save insight: ${saveError.message}${hint}` }, 500);
    }

    if (body.notify) {
      await maybeEnqueueNotification(admin, childId, user.id, generated);
    }

    return jsonResponse({ insight: saved, cached: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("generate-parent-insight crash:", msg);
    return jsonResponse({ error: msg }, 500);
  }
});
