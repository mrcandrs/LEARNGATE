/// <reference path="../deno-shim.d.ts" />
/**
 * Drains public.notification_outbox and sends via Expo Push API.
 * Runs on Supabase Edge (Deno) — open this folder with the Deno extension enabled (see .vscode/settings.json).
 *
 * Deploy: npx supabase functions deploy send-push-notifications --no-verify-jwt
 * Secrets: CRON_SECRET
 */
// npm: import is required for Supabase Edge deploy (Deno bundler).
// @ts-expect-error Deno resolves npm: specifiers at deploy time
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";
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
  priority?: "default" | "normal" | "high";
  channelId?: string;
};

type RowResult = {
  outbox_id: number;
  event_type: string;
  status: "sent" | "skipped" | "no_tokens";
  child_user_id: string | null;
  child_token_count: number;
  parent_token_count: number;
  note?: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type ExpoTicket = { status: string; id?: string; message?: string; details?: { error?: string } };

async function sendExpoBatch(chunk: ExpoMsg[]): Promise<ExpoTicket[]> {
  if (chunk.length === 0) return [];
  const res = await fetch(EXPO_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(chunk),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`Expo push failed ${res.status}: ${JSON.stringify(body)}`);
  }
  const tickets = (body?.data ?? []) as ExpoTicket[];
  const errors = tickets.filter((t) => t.status === "error");
  if (errors.length === tickets.length && tickets.length > 0) {
    throw new Error(`Expo push tickets all failed: ${JSON.stringify(errors)}`);
  }
  return tickets;
}

async function latestTokensForUser(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const { data } = await supabase
    .from("push_tokens")
    .select("token")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1);
  const token = data?.[0]?.token;
  return token ? [token] : [];
}

function targetsChild(eventType: string): boolean {
  return eventType === "task_assigned" || eventType === "chore_approved";
}

function targetsParent(eventType: string): boolean {
  return (
    eventType === "task_submitted" ||
    eventType === "task_completed" ||
    eventType === "child_game_milestone"
  );
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
  const results: RowResult[] = [];

  for (const row of batch) {
    const p = row.payload;
    const childId = p.child_id as string | undefined;
    if (!childId) {
      processedIds.push(row.id);
      results.push({
        outbox_id: row.id,
        event_type: row.event_type,
        status: "skipped",
        child_user_id: null,
        child_token_count: 0,
        parent_token_count: 0,
        note: "missing child_id in payload",
      });
      continue;
    }

    const { data: child, error: childErr } = await supabase
      .from("children")
      .select("name, parent_id, child_user_id")
      .eq("id", childId)
      .maybeSingle();

    if (childErr || !child) {
      processedIds.push(row.id);
      results.push({
        outbox_id: row.id,
        event_type: row.event_type,
        status: "skipped",
        child_user_id: null,
        child_token_count: 0,
        parent_token_count: 0,
        note: "child row not found",
      });
      continue;
    }

    const childName = (child.name as string) ?? "Your child";
    const parentId = child.parent_id as string;
    const childUserId = child.child_user_id as string | null;

    const parentTokenList = await latestTokensForUser(supabase, parentId);
    const childTokenList = childUserId ? await latestTokensForUser(supabase, childUserId) : [];

    const title = (p.title as string) ?? "";
    let pushedForRow = 0;

    if (row.event_type === "task_assigned") {
      for (const to of childTokenList) {
        messages.push({
          to,
          title: "New task",
          body: `${title || "A new task"} was added for you.`,
          data: { kind: "task_assigned", task_id: p.task_id },
          sound: "default",
          priority: "high",
          channelId: "tasks",
        });
        pushedForRow++;
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
        pushedForRow++;
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
        pushedForRow++;
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
        pushedForRow++;
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
        pushedForRow++;
      }
    } else {
      processedIds.push(row.id);
      results.push({
        outbox_id: row.id,
        event_type: row.event_type,
        status: "skipped",
        child_user_id: childUserId,
        child_token_count: childTokenList.length,
        parent_token_count: parentTokenList.length,
        note: "unknown event_type",
      });
      continue;
    }

    const needsChild = targetsChild(row.event_type);
    const needsParent = targetsParent(row.event_type);

    if (pushedForRow > 0) {
      processedIds.push(row.id);
      results.push({
        outbox_id: row.id,
        event_type: row.event_type,
        status: "sent",
        child_user_id: childUserId,
        child_token_count: childTokenList.length,
        parent_token_count: parentTokenList.length,
      });
    } else {
      let note = "no push token for target user";
      if (needsChild && !childUserId) {
        note = "children.child_user_id is NULL — link child login to children row";
      } else if (needsChild && childTokenList.length === 0) {
        note = "child has no row in push_tokens — open child app and sign in on child device";
      } else if (needsParent && parentTokenList.length === 0) {
        note = "parent has no row in push_tokens";
      }

      results.push({
        outbox_id: row.id,
        event_type: row.event_type,
        status: "no_tokens",
        child_user_id: childUserId,
        child_token_count: childTokenList.length,
        parent_token_count: parentTokenList.length,
        note,
      });
    }
  }

  const expoTickets: ExpoTicket[] = [];
  try {
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      const tickets = await sendExpoBatch(chunk);
      for (let j = 0; j < tickets.length; j++) {
        const ticket = tickets[j];
        expoTickets.push(ticket);
        if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
          const badToken = chunk[j]?.to;
          if (badToken) {
            await supabase.from("push_tokens").delete().eq("token", badToken);
          }
        }
      }
    }
  } catch (e) {
    return jsonResponse({ error: String(e), partial: true, results, expo_tickets: expoTickets }, 500);
  }

  if (processedIds.length > 0) {
    const now = new Date().toISOString();
    await supabase.from("notification_outbox").update({ processed_at: now }).in("id", processedIds);
  }

  return jsonResponse({
    ok: true,
    outbox_rows: batch.length,
    messages_sent: messages.length,
    tokens_used: messages.map((m) => m.to),
    expo_tickets: expoTickets,
    processed_outbox_ids: processedIds,
    results,
    hint:
      batch.length > 0 && messages.length === 0
        ? "Outbox has rows but nothing was sent — read results[].note (usually child_user_id or push_tokens)."
        : batch.length === 0
          ? "No unprocessed outbox rows. Create a task, then run this function again."
          : "If messages_sent > 0 but no phone alert, check MuMu notification settings and FCM on Expo.",
  });
});
