import type { ParentChildInsight } from "@/components/parent/ParentInsightsSummaryCard";
import { supabase } from "@/services/supabase";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { tRuntime } from "@/i18n/runtimeLocale";

export type StoredParentInsight = {
  child_id: string;
  parent_id: string;
  summary: string;
  latest_task_line: string;
  focus_areas: string;
  recommendation: string;
  next_best_step: string;
  generated_at: string;
  model: string | null;
};

export function formatGeneratedAgo(generatedAt: string | undefined): string | null {
  if (!generatedAt) {
    return null;
  }
  const ms = Date.now() - new Date(generatedAt).getTime();
  if (ms < 60_000) {
    return tRuntime("parent.insights.generatedJustNow");
  }
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) {
    return tRuntime("parent.insights.generatedMins", { count: mins });
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return hours === 1
      ? tRuntime("parent.insights.generatedHour")
      : tRuntime("parent.insights.generatedHours", { count: hours });
  }
  const days = Math.floor(hours / 24);
  return days === 1
    ? tRuntime("parent.insights.generatedDay")
    : tRuntime("parent.insights.generatedDays", { count: days });
}

export function storedInsightToCard(stored: StoredParentInsight, childName: string): ParentChildInsight {
  return {
    childName,
    summary: stored.summary,
    latestTaskLine: stored.latest_task_line,
    focusAreas: stored.focus_areas,
    recommendation: stored.recommendation,
    nextBestStep: stored.next_best_step,
  };
}

export async function fetchStoredParentInsights(childIds: string[]): Promise<StoredParentInsight[]> {
  if (!supabase || childIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("parent_child_insights")
    .select(
      "child_id, parent_id, summary, latest_task_line, focus_areas, recommendation, next_best_step, generated_at, model"
    )
    .in("child_id", childIds);

  if (error) {
    if (__DEV__) {
      console.warn("[insights] fetch:", error.message);
    }
    return [];
  }

  return (data ?? []) as StoredParentInsight[];
}

type GenerateInsightResult =
  | { ok: true; insight: StoredParentInsight; cached: boolean }
  | { ok: false; message: string };

async function readFunctionErrorDetail(error: unknown, data: unknown): Promise<string> {
  if (typeof data === "object" && data !== null && "error" in data && typeof (data as { error: unknown }).error === "string") {
    return (data as { error: string }).error;
  }

  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as { error?: string };
      if (body?.error) {
        return body.error;
      }
    } catch {
      /* fall through */
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error calling generate-parent-insight";
}

/** Calls the Supabase edge function to generate (or return cached) an AI insight. */
export async function generateParentInsight(
  childId: string,
  options?: { force?: boolean; notify?: boolean }
): Promise<GenerateInsightResult> {
  if (!supabase) {
    return { ok: false, message: "Supabase is not configured." };
  }

  const { data, error } = await supabase.functions.invoke("generate-parent-insight", {
    body: {
      child_id: childId,
      force: options?.force ?? false,
      notify: options?.notify ?? false,
    },
  });

  const payload = data as { insight?: StoredParentInsight; error?: string; cached?: boolean } | null;

  if (error) {
    const detail = await readFunctionErrorDetail(error, data);
    const hint = /GEMINI_API_KEY/i.test(detail)
      ? " Get a free key at aistudio.google.com, then run: npx supabase secrets set GEMINI_API_KEY=..."
      : /parent_child_insights/i.test(detail)
        ? " Run supabase/step-aa-parent-child-insights.sql in the Supabase SQL Editor."
        : /generate-parent-insight|not found|404/i.test(detail)
          ? " Deploy the function: npx supabase functions deploy generate-parent-insight"
          : "";
    return { ok: false, message: `${detail}${hint}` };
  }

  if (!payload?.insight) {
    return { ok: false, message: payload?.error ?? "No insight returned." };
  }

  return { ok: true, insight: payload.insight, cached: Boolean(payload.cached) };
}
