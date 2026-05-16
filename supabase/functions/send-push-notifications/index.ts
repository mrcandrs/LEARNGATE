/// <reference path="../deno-shim.d.ts" />
/**
 * Drains public.notification_outbox and sends via Expo Push API.
 * Optional body: { "check_child_tokens": true } — ping child tokens (cron) to detect uninstall.
 *
 * Deploy: npx supabase functions deploy send-push-notifications --no-verify-jwt
 * Secrets: CRON_SECRET
 */
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
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: "default";
  priority?: "default" | "normal" | "high";
  channelId?: string;
};

/** Internal: ties an Expo message back to an outbox row for post-send ack. */
type OutboxExpoMsg = ExpoMsg & { outboxId?: number };

type RowResult = {
  outbox_id: number;
  event_type: string;
  status: "sent" | "skipped" | "no_tokens" | "pending";
  child_user_id: string | null;
  child_token_count: number;
  parent_token_count: number;
  note?: string;
};

type ExpoTicket = { status: string; id?: string; message?: string; details?: { error?: string } };

type DrainResult = {
  messages: OutboxExpoMsg[];
  /** Mark after Expo confirms delivery (or for skips / non-uninstall no-token rows). */
  processedIds: number[];
  results: RowResult[];
};

type ChildRow = { child_user_id: string | null };
type TokenRow = { token: string; user_id: string };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isRevokedTokenTicket(ticket: ExpoTicket): boolean {
  const err = ticket.details?.error ?? "";
  if (err === "DeviceNotRegistered" || err === "InvalidCredentials") {
    return true;
  }
  const msg = (ticket.message ?? "").toLowerCase();
  return msg.includes("not registered") || msg.includes("device token");
}

function toExpoPayload(chunk: OutboxExpoMsg[]): ExpoMsg[] {
  return chunk.map(({ outboxId: _id, ...msg }) => msg);
}

async function sendExpoBatch(chunk: OutboxExpoMsg[]): Promise<ExpoTicket[]> {
  if (chunk.length === 0) return [];
  const res = await fetch(EXPO_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(toExpoPayload(chunk)),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`Expo push failed ${res.status}: ${JSON.stringify(body)}`);
  }
  const tickets = (body?.data ?? []) as ExpoTicket[];
  if (tickets.length !== chunk.length) {
    console.warn(
      `Expo ticket count (${tickets.length}) != message count (${chunk.length})`,
    );
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
    eventType === "child_game_milestone" ||
    eventType === "child_app_uninstalled" ||
    eventType === "parent_insight"
  );
}

async function revokeChildToken(supabase: SupabaseClient, token: string): Promise<boolean> {
  const { data: enqueued, error } = await supabase.rpc("fn_enqueue_child_app_uninstalled", {
    p_token: token,
  });
  if (error) {
    console.error("fn_enqueue_child_app_uninstalled:", error.message);
    return false;
  }
  await supabase.from("push_tokens").delete().eq("token", token);
  return enqueued === true;
}

async function sendMessagesAndRevokeInvalid(
  supabase: SupabaseClient,
  messages: OutboxExpoMsg[],
): Promise<{
  tickets: ExpoTicket[];
  revoked: string[];
  enqueuedUninstall: number;
  confirmedOutboxIds: number[];
}> {
  const tickets: ExpoTicket[] = [];
  const revoked: string[] = [];
  const confirmedOutboxIds: number[] = [];
  let enqueuedUninstall = 0;

  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const batchTickets = await sendExpoBatch(chunk);
    const n = Math.min(chunk.length, batchTickets.length);

    for (let j = 0; j < n; j++) {
      const ticket = batchTickets[j];
      const msg = chunk[j];
      tickets.push(ticket);

      if (ticket.status === "ok" && msg.outboxId != null) {
        confirmedOutboxIds.push(msg.outboxId);
      }

      if (ticket.status === "error" && isRevokedTokenTicket(ticket)) {
        const badToken = msg.to;
        if (badToken && !revoked.includes(badToken)) {
          revoked.push(badToken);
          if (await revokeChildToken(supabase, badToken)) {
            enqueuedUninstall += 1;
          }
        }
      }
    }
  }

  return {
    tickets,
    revoked,
    enqueuedUninstall,
    confirmedOutboxIds: [...new Set(confirmedOutboxIds)],
  };
}

/** Data-only ping — no visible notification on the child device. */
async function checkChildPushTokens(supabase: SupabaseClient): Promise<{
  tokens_checked: number;
  revoked: string[];
  enqueued_uninstall: number;
}> {
  const { data: children, error: childErr } = await supabase
    .from("children")
    .select("child_user_id")
    .not("child_user_id", "is", null);

  if (childErr || !children?.length) {
    return { tokens_checked: 0, revoked: [], enqueued_uninstall: 0 };
  }

  const childUserIds = new Set(
    (children as ChildRow[]).map((c) => c.child_user_id).filter((id): id is string => Boolean(id)),
  );

  const { data: tokenRows, error: tokErr } = await supabase
    .from("push_tokens")
    .select("token, user_id");

  if (tokErr || !tokenRows?.length) {
    return { tokens_checked: 0, revoked: [], enqueued_uninstall: 0 };
  }

  const pings: OutboxExpoMsg[] = (tokenRows as TokenRow[])
    .filter((r) => childUserIds.has(r.user_id))
    .map((r) => ({
      to: r.token,
      data: { kind: "token_health_ping" },
      priority: "normal" as const,
    }));

  const { revoked, enqueuedUninstall } = await sendMessagesAndRevokeInvalid(supabase, pings);
  return {
    tokens_checked: pings.length,
    revoked,
    enqueued_uninstall: enqueuedUninstall,
  };
}

async function buildOutboxDrain(supabase: SupabaseClient): Promise<DrainResult> {
  const { data: rows, error: fetchError } = await supabase
    .from("notification_outbox")
    .select("id, event_type, payload")
    .is("processed_at", null)
    .order("id", { ascending: true })
    .limit(40);

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  const batch = (rows ?? []) as OutboxRow[];
  const messages: OutboxExpoMsg[] = [];
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
    const deferProcessed = row.event_type === "child_app_uninstalled";

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
    } else if (row.event_type === "child_app_uninstalled") {
      for (const to of parentTokenList) {
        messages.push({
          to,
          outboxId: row.id,
          title: "App may be uninstalled",
          body: `LEARNGATE on ${childName}'s device may have been uninstalled or had its data cleared. Open the child app again to restore monitoring.`,
          data: { kind: "child_app_uninstalled", child_id: childId },
          sound: "default",
          channelId: "tasks",
        });
        pushedForRow++;
      }
    } else if (row.event_type === "child_device_offline") {
      processedIds.push(row.id);
      results.push({
        outbox_id: row.id,
        event_type: row.event_type,
        status: "skipped",
        child_user_id: childUserId,
        child_token_count: childTokenList.length,
        parent_token_count: parentTokenList.length,
        note: "legacy offline alert — skipped",
      });
      continue;
    } else if (row.event_type === "parent_insight") {
      const insightBody =
        (p.body as string) ??
        `${(p.child_name as string) ?? childName} may need a small schedule tweak this week.`;
      for (const to of parentTokenList) {
        messages.push({
          to,
          title: "Insight for you",
          body: insightBody,
          data: { kind: "parent_insight", child_id: childId },
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
      if (!deferProcessed) {
        processedIds.push(row.id);
      }
      results.push({
        outbox_id: row.id,
        event_type: row.event_type,
        status: deferProcessed ? "pending" : "sent",
        child_user_id: childUserId,
        child_token_count: childTokenList.length,
        parent_token_count: parentTokenList.length,
        note: deferProcessed ? "waiting for Expo delivery ack" : undefined,
      });
    } else {
      let note = "no push token for target user";
      if (needsChild && !childUserId) {
        note = "children.child_user_id is NULL — link child login to children row";
      } else if (needsChild && childTokenList.length === 0) {
        note = "child has no row in push_tokens";
      } else if (needsParent && parentTokenList.length === 0) {
        note = "parent has no row in push_tokens";
      }

      if (deferProcessed) {
        results.push({
          outbox_id: row.id,
          event_type: row.event_type,
          status: "pending",
          child_user_id: childUserId,
          child_token_count: childTokenList.length,
          parent_token_count: parentTokenList.length,
          note,
        });
      } else {
        processedIds.push(row.id);
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
  }

  return { messages, processedIds, results };
}

async function markProcessed(supabase: SupabaseClient, ids: number[]) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;
  const now = new Date().toISOString();
  await supabase.from("notification_outbox").update({ processed_at: now }).in("id", unique);
}

async function parseRequestBody(req: Request): Promise<{ checkChildTokens: boolean }> {
  if (req.method === "GET" || req.method === "HEAD") {
    return { checkChildTokens: false };
  }
  const text = await req.text();
  if (!text.trim()) {
    return { checkChildTokens: false };
  }
  try {
    const body = JSON.parse(text) as { check_child_tokens?: boolean };
    return { checkChildTokens: Boolean(body.check_child_tokens) };
  } catch {
    return { checkChildTokens: false };
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

  const { checkChildTokens } = await parseRequestBody(req);
  const supabase = createClient(supabaseUrl, serviceKey);

  let healthCheck: Awaited<ReturnType<typeof checkChildPushTokens>> | null = null;
  if (checkChildTokens) {
    healthCheck = await checkChildPushTokens(supabase);
  }

  const allResults: RowResult[] = [];
  const allTickets: ExpoTicket[] = [];
  const allProcessedIds: number[] = [];
  let totalMessages = 0;
  let totalRevoked = 0;
  let totalEnqueuedUninstall = healthCheck?.enqueued_uninstall ?? 0;
  let outboxPasses = 0;

  try {
    for (let pass = 0; pass < 3; pass++) {
      const drain = await buildOutboxDrain(supabase);
      const hasWork = drain.messages.length > 0 || drain.processedIds.length > 0;

      if (pass > 0 && !hasWork) {
        break;
      }

      if (!hasWork && pass === 0 && !checkChildTokens) {
        break;
      }

      if (!hasWork) {
        continue;
      }

      outboxPasses += 1;

      const { tickets, revoked, enqueuedUninstall, confirmedOutboxIds } =
        await sendMessagesAndRevokeInvalid(supabase, drain.messages);

      const idsToMark = [...drain.processedIds, ...confirmedOutboxIds];

      allTickets.push(...tickets);
      allResults.push(...drain.results);
      allProcessedIds.push(...idsToMark);
      totalMessages += drain.messages.length;
      totalRevoked += revoked.length;
      totalEnqueuedUninstall += enqueuedUninstall;

      await markProcessed(supabase, idsToMark);

      if (enqueuedUninstall > 0) {
        continue;
      }

      if (drain.messages.length === 0) {
        break;
      }
    }
  } catch (e) {
    return jsonResponse(
      {
        error: String(e),
        partial: true,
        health_check: healthCheck,
        outbox_passes: outboxPasses,
        results: allResults,
        expo_tickets: allTickets,
      },
      500,
    );
  }

  return jsonResponse({
    ok: true,
    health_check: healthCheck,
    outbox_passes: outboxPasses,
    messages_sent: totalMessages,
    tokens_revoked: totalRevoked,
    uninstall_alerts_enqueued: totalEnqueuedUninstall,
    expo_tickets: allTickets,
    processed_outbox_ids: [...new Set(allProcessedIds)],
    results: allResults,
    hint:
      totalEnqueuedUninstall > 0
        ? "Uninstall alert enqueued — a follow-up pass should deliver it to the parent."
        : checkChildTokens
          ? "Token health check ran. See tokens_checked / tokens_revoked."
          : allResults.some((r) => r.status === "pending")
            ? "Some rows are pending (parent has no push token or Expo did not ack yet)."
            : "No unprocessed outbox rows.",
  });
});
