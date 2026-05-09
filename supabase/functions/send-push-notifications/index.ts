/**
 * Drains public.notification_outbox and sends via Expo Push API.
 *
 * Deploy: supabase functions deploy send-push-notifications --no-verify-jwt
 * Secrets (Dashboard → Edge Functions → Secrets): CRON_SECRET
 *
 * Schedule: Dashboard → Edge Functions → send-push-notifications → Schedules (every 1 min), or:
 *   curl -X POST "$SUPABASE_URL/functions/v1/send-push-notifications" \
 *     -H "x-cron-secret: $CRON_SECRET" -H "Content-Type: application/json" -d '{}'
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const EXPO_URL = "https://exp.host/--/api/v2/push/send";

type OutboxRow = {
  id: number;
  event_type: string;
  payload: Record<string, unknown>;
};

type ExpoMsg = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default";
  channelId?: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function sendExpoBatch(messages: ExpoMsg[]) {
  if (messages.length === 0) return;
  const res = await fetch(EXPO_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Expo push failed ${res.status}: ${t}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: "Missing Supabase env" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: rows, error: fetchError } = await supabase
    .from("notification_outbox")
    .select("id, event_type, payload")
    .is("processed_at", null)
    .order("id", { ascending: true })
    .limit(40);

  if (fetchError) {
    return jsonResponse({ error: fetchError.message }, 500);
  }

  const batch = (rows ?? []) as OutboxRow[];
  const messages: ExpoMsg[] = [];
  const processedIds: number[] = [];

  for (const row of batch) {
    const p = row.payload;
    const childId = p.child_id as string | undefined;
    if (!childId) {
      processedIds.push(row.id);
      continue;
    }

    const { data: child, error: childErr } = await supabase
      .from("children")
      .select("name, parent_id, child_user_id")
      .eq("id", childId)
      .maybeSingle();

    if (childErr || !child) {
      processedIds.push(row.id);
      continue;
    }

    const childName = (child.name as string) ?? "Your child";
    const parentId = child.parent_id as string;
    const childUserId = child.child_user_id as string | null;

    const { data: parentTokens } = await supabase.from("push_tokens").select("token").eq("user_id", parentId);
    const { data: childTokens } = childUserId
      ? await supabase.from("push_tokens").select("token").eq("user_id", childUserId)
      : { data: [] as { token: string }[] };

    const parentTokenList = (parentTokens ?? []).map((r) => r.token).filter(Boolean);
    const childTokenList = (childTokens ?? []).map((r) => r.token).filter(Boolean);

    const title = (p.title as string) ?? "";

    if (row.event_type === "task_assigned") {
      for (const to of childTokenList) {
        messages.push({
          to,
          title: "New task",
          body: `${title || "A new task"} was added for you.`,
          data: { kind: "task_assigned", task_id: p.task_id },
          sound: "default",
          channelId: "tasks",
        });
      }
    } else if (row.event_type === "task_submitted") {
      for (const to of parentTokenList) {
        messages.push({
          to,
          title: "Submission to review",
          body: `${childName} submitted “${title || "a chore"}” for review.`,
          data: { kind: "task_submitted", task_id: p.task_id, child_id: childId },
          sound: "default",
          channelId: "tasks",
        });
      }
    } else if (row.event_type === "task_completed") {
      for (const to of parentTokenList) {
        messages.push({
          to,
          title: "Task completed",
          body: `${childName} completed “${title || "a task"}”.`,
          data: { kind: "task_completed", task_id: p.task_id, child_id: childId },
          sound: "default",
          channelId: "tasks",
        });
      }
    } else if (row.event_type === "chore_approved") {
      for (const to of childTokenList) {
        messages.push({
          to,
          title: "Chore approved",
          body: `Great job! “${title || "Your chore"}” was approved.`,
          data: { kind: "chore_approved", task_id: p.task_id },
          sound: "default",
          channelId: "tasks",
        });
      }
    } else if (row.event_type === "child_game_milestone") {
      const pts = (p.points as number) ?? 0;
      for (const to of parentTokenList) {
        messages.push({
          to,
          title: "Learning update",
          body: `${childName} earned ${pts} stars from a learning game.`,
          data: { kind: "child_game_milestone", child_id: childId },
          sound: "default",
          channelId: "tasks",
        });
      }
    }

    processedIds.push(row.id);
  }

  try {
    for (let i = 0; i < messages.length; i += 100) {
      await sendExpoBatch(messages.slice(i, i + 100));
    }
  } catch (e) {
    return jsonResponse({ error: String(e), partial: true }, 500);
  }

  if (processedIds.length > 0) {
    const now = new Date().toISOString();
    await supabase.from("notification_outbox").update({ processed_at: now }).in("id", processedIds);
  }

  return jsonResponse({ ok: true, outbox_rows: batch.length, messages: messages.length });
});
