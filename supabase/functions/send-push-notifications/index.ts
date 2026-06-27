/// <reference path="../deno-shim.d.ts" />
/**
 * Drains notification_outbox + detects uninstalled child apps via Expo push receipts.
 *
 * Body: { "check_child_tokens": true } — ping all child push tokens (use on a schedule).
 *
 * Deploy: npx supabase functions deploy send-push-notifications --no-verify-jwt
 */
// @ts-expect-error Deno resolves npm: specifiers at deploy time
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";

const EXPO_SEND_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const RECEIPT_WAIT_MS = 2000;

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

type OutboxExpoMsg = ExpoMsg & { outboxId?: number; childUserId?: string };

type RowResult = {
  outbox_id: number;
  event_type: string;
  status: "queued" | "sent" | "skipped" | "no_tokens" | "pending" | "expo_error";
  child_user_id: string | null;
  child_token_count: number;
  parent_token_count: number;
  note?: string;
  expo_ticket?: "ok" | "error";
  expo_error?: string;
  target_token_prefix?: string;
};

type ExpoTicket = { status: string; id?: string; message?: string; details?: { error?: string } };
type ExpoReceipt = { status: string; message?: string; details?: { error?: string } };

type ChildRecord = { id: string; name: string; parent_id: string; child_user_id: string | null };
type TokenRow = { token: string; user_id: string };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isRevokedPushError(err?: string, message?: string): boolean {
  if (err === "DeviceNotRegistered" || err === "InvalidCredentials") return true;
  const msg = (message ?? "").toLowerCase();
  return msg.includes("not registered") || msg.includes("device token") || msg.includes("unregistered");
}

function toExpoPayload(chunk: OutboxExpoMsg[]): ExpoMsg[] {
  return chunk.map(({ outboxId: _o, childUserId: _c, ...msg }) => msg);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function sendExpoBatch(chunk: OutboxExpoMsg[]): Promise<ExpoTicket[]> {
  if (chunk.length === 0) return [];
  const res = await fetch(EXPO_SEND_URL, {
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
  return (body?.data ?? []) as ExpoTicket[];
}

async function fetchExpoReceipts(
  ticketIds: string[],
): Promise<Record<string, ExpoReceipt>> {
  if (ticketIds.length === 0) return {};
  const res = await fetch(EXPO_RECEIPTS_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ids: ticketIds }),
  });
  const body = await res.json();
  if (!res.ok) {
    console.warn("Expo getReceipts failed:", JSON.stringify(body));
    return {};
  }
  return (body?.data ?? {}) as Record<string, ExpoReceipt>;
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

async function childForPushToken(
  supabase: SupabaseClient,
  token: string,
): Promise<{ child: ChildRecord; token: string } | null> {
  const { data: tok } = await supabase
    .from("push_tokens")
    .select("token, user_id")
    .eq("token", token)
    .maybeSingle();
  if (!tok?.user_id) return null;

  const { data: child } = await supabase
    .from("children")
    .select("id, name, parent_id, child_user_id")
    .eq("child_user_id", tok.user_id)
    .maybeSingle();

  if (!child) return null;
  return { child: child as ChildRecord, token: tok.token as string };
}

/** Tell the parent immediately — do not rely on a second outbox drain pass. */
async function deliverUninstallAlertToParent(
  supabase: SupabaseClient,
  child: ChildRecord,
): Promise<{ sent: boolean; parentTokenCount: number }> {
  const parentTokens = await latestTokensForUser(supabase, child.parent_id);
  if (parentTokens.length === 0) {
    return { sent: false, parentTokenCount: 0 };
  }

  const childName = child.name ?? "Your child";
  const messages: OutboxExpoMsg[] = parentTokens.map((to) => ({
    to,
    title: "App may be uninstalled",
    body: `LEARNGATE on ${childName}'s device may have been uninstalled or had its data cleared. Open the child app again to restore monitoring.`,
    data: { kind: "child_app_uninstalled", child_id: child.id },
    sound: "default",
    channelId: "tasks",
    priority: "high",
  }));

  const tickets = await sendExpoBatch(messages);
  const sent = tickets.some((t) => t.status === "ok");
  return { sent, parentTokenCount: parentTokens.length };
}

/** Remove stale token; uninstall flow only when the token belonged to a child account. */
async function handleRevokedPushToken(
  supabase: SupabaseClient,
  token: string,
): Promise<{ enqueued: boolean; parentNotified: boolean; childId: string | null }> {
  const match = await childForPushToken(supabase, token);
  if (!match) {
    await supabase.from("push_tokens").delete().eq("token", token);
    return { enqueued: false, parentNotified: false, childId: null };
  }

  const { child } = match;

  const { data: enqueued, error } = await supabase.rpc("fn_enqueue_child_app_uninstalled", {
    p_token: token,
  });
  if (error) {
    console.error("fn_enqueue_child_app_uninstalled:", error.message);
  }

  await supabase.from("push_tokens").delete().eq("token", token);

  const { sent: parentNotified } = await deliverUninstallAlertToParent(supabase, child);

  if (enqueued === true) {
    const { data: pending } = await supabase
      .from("notification_outbox")
      .select("id")
      .eq("event_type", "child_app_uninstalled")
      .filter("payload->>child_id", "eq", child.id)
      .is("processed_at", null)
      .order("id", { ascending: false })
      .limit(1);

    if (pending?.[0]?.id && parentNotified) {
      await supabase
        .from("notification_outbox")
        .update({ processed_at: new Date().toISOString() })
        .eq("id", pending[0].id);
    }
  }

  return {
    enqueued: enqueued === true,
    parentNotified,
    childId: child.id,
  };
}

async function processTicketsForRevokedTokens(
  supabase: SupabaseClient,
  chunk: OutboxExpoMsg[],
  tickets: ExpoTicket[],
): Promise<{ revoked: string[]; uninstallHandled: number }> {
  const revoked: string[] = [];
  let uninstallHandled = 0;
  const n = Math.min(chunk.length, tickets.length);

  for (let j = 0; j < n; j++) {
    const ticket = tickets[j];
    const msg = chunk[j];
    if (ticket.status === "error" && isRevokedPushError(ticket.details?.error, ticket.message)) {
      if (msg.to && !revoked.includes(msg.to)) {
        revoked.push(msg.to);
        const result = await handleRevokedPushToken(supabase, msg.to);
        if (result.childId) uninstallHandled += 1;
      }
    }
  }

  const okIds = tickets
    .map((t, j) => (t.status === "ok" && t.id ? { id: t.id, to: chunk[j]?.to } : null))
    .filter((x): x is { id: string; to: string } => Boolean(x?.id && x?.to));

  if (okIds.length === 0) return { revoked, uninstallHandled };

  await sleep(RECEIPT_WAIT_MS);
  const receipts = await fetchExpoReceipts(okIds.map((x) => x.id));

  for (const { id, to } of okIds) {
    const receipt = receipts[id];
    if (!receipt || receipt.status !== "error") continue;
    if (!isRevokedPushError(receipt.details?.error, receipt.message)) continue;
    if (revoked.includes(to)) continue;
    revoked.push(to);
    const result = await handleRevokedPushToken(supabase, to);
    if (result.childId) uninstallHandled += 1;
  }

  return { revoked, uninstallHandled };
}

async function sendMessagesAndRevokeInvalid(
  supabase: SupabaseClient,
  messages: OutboxExpoMsg[],
): Promise<{
  tickets: ExpoTicket[];
  revoked: string[];
  uninstallHandled: number;
  confirmedOutboxIds: number[];
}> {
  const tickets: ExpoTicket[] = [];
  const revoked: string[] = [];
  const confirmedOutboxIds: number[] = [];
  let uninstallHandled = 0;

  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const batchTickets = await sendExpoBatch(chunk);
    tickets.push(...batchTickets);

    for (let j = 0; j < Math.min(chunk.length, batchTickets.length); j++) {
      if (batchTickets[j].status === "ok" && chunk[j].outboxId != null) {
        confirmedOutboxIds.push(chunk[j].outboxId!);
      }
    }

    const { revoked: batchRevoked, uninstallHandled: batchHandled } =
      await processTicketsForRevokedTokens(supabase, chunk, batchTickets);
    revoked.push(...batchRevoked.filter((t) => !revoked.includes(t)));
    uninstallHandled += batchHandled;
  }

  return {
    tickets,
    revoked: [...new Set(revoked)],
    uninstallHandled,
    confirmedOutboxIds: [...new Set(confirmedOutboxIds)],
  };
}

async function checkChildPushTokens(supabase: SupabaseClient): Promise<{
  tokens_checked: number;
  revoked: string[];
  uninstall_handled: number;
  parent_notified: number;
}> {
  const { data: children, error: childErr } = await supabase
    .from("children")
    .select("child_user_id")
    .not("child_user_id", "is", null);

  if (childErr || !children?.length) {
    return { tokens_checked: 0, revoked: [], uninstall_handled: 0, parent_notified: 0 };
  }

  const childUserIds = new Set(
    children.map((c: { child_user_id: string }) => c.child_user_id).filter(Boolean),
  );

  const { data: tokenRows, error: tokErr } = await supabase
    .from("push_tokens")
    .select("token, user_id");

  if (tokErr || !tokenRows?.length) {
    return { tokens_checked: 0, revoked: [], uninstall_handled: 0, parent_notified: 0 };
  }

  // Data-only ping — must not show title/body or children see "Checking device connection".
  const pings: OutboxExpoMsg[] = (tokenRows as TokenRow[])
    .filter((r) => childUserIds.has(r.user_id))
    .map((r) => ({
      to: r.token,
      data: { kind: "token_health_ping" },
      priority: "normal" as const,
      childUserId: r.user_id,
    }));

  let parentNotified = 0;
  const { revoked, uninstallHandled } = await sendMessagesAndRevokeInvalid(supabase, pings);
  if (uninstallHandled > 0) parentNotified = uninstallHandled;

  return {
    tokens_checked: pings.length,
    revoked,
    uninstall_handled: uninstallHandled,
    parent_notified: parentNotified,
  };
}

async function buildOutboxDrain(supabase: SupabaseClient): Promise<{
  messages: OutboxExpoMsg[];
  processedIds: number[];
  results: RowResult[];
}> {
  const { data: rows, error: fetchError } = await supabase
    .from("notification_outbox")
    .select("id, event_type, payload")
    .is("processed_at", null)
    .order("id", { ascending: true })
    .limit(40);

  if (fetchError) throw new Error(fetchError.message);

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
    const isUninstall = row.event_type === "child_app_uninstalled";

    if (row.event_type === "task_assigned") {
      for (const to of childTokenList) {
        messages.push({
          to,
          outboxId: row.id,
          title: "New task",
          body: `${title || "A new task"} was added for you.`,
          data: {
            kind: "task_assigned",
            task_id: p.task_id,
            child_id: childId,
            category: (p.category as string) ?? "",
          },
          sound: "default",
          priority: "high",
          channelId: "tasks",
          childUserId: childUserId ?? undefined,
        });
        pushedForRow++;
      }
    } else if (row.event_type === "task_submitted") {
      for (const to of parentTokenList) {
        messages.push({
          to,
          outboxId: row.id,
          title: "Submission to review",
          body: `${childName} submitted “${title || "a chore"}” for review.`,
          data: { kind: "task_submitted", task_id: p.task_id, child_id: childId },
          sound: "default",
          priority: "high",
          channelId: "tasks",
        });
        pushedForRow++;
      }
    } else if (row.event_type === "task_completed") {
      for (const to of parentTokenList) {
        messages.push({
          to,
          outboxId: row.id,
          title: "Task completed",
          body: `${childName} completed “${title || "a task"}”.`,
          data: { kind: "task_completed", task_id: p.task_id, child_id: childId },
          sound: "default",
          priority: "high",
          channelId: "tasks",
        });
        pushedForRow++;
      }
    } else if (row.event_type === "chore_approved") {
      for (const to of childTokenList) {
        messages.push({
          to,
          outboxId: row.id,
          title: "Chore approved",
          body: `Great job! “${title || "Your chore"}” was approved.`,
          data: {
            kind: "chore_approved",
            task_id: p.task_id,
            child_id: childId,
            category: "chore",
          },
          sound: "default",
          channelId: "tasks",
          childUserId: childUserId ?? undefined,
        });
        pushedForRow++;
      }
    } else if (row.event_type === "child_game_milestone") {
      const pts = (p.points as number) ?? 0;
      for (const to of parentTokenList) {
        messages.push({
          to,
          outboxId: row.id,
          title: "Learning update",
          body: `${childName} earned ${pts} stars from a learning game.`,
          data: { kind: "child_game_milestone", child_id: childId },
          sound: "default",
          priority: "high",
          channelId: "tasks",
        });
        pushedForRow++;
      }
    } else if (isUninstall) {
      for (const to of parentTokenList) {
        messages.push({
          to,
          outboxId: row.id,
          title: "App may be uninstalled",
          body: `LEARNGATE on ${childName}'s device may have been uninstalled or had its data cleared. Open the child app again to restore monitoring.`,
          data: { kind: "child_app_uninstalled", child_id: childId },
          sound: "default",
          channelId: "tasks",
          priority: "high",
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
          outboxId: row.id,
          title: "Insight for you",
          body: insightBody,
          data: { kind: "parent_insight", child_id: childId },
          sound: "default",
          priority: "high",
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

    if (pushedForRow > 0) {
      results.push({
        outbox_id: row.id,
        event_type: row.event_type,
        status: isUninstall ? "pending" : "queued",
        child_user_id: childUserId,
        child_token_count: childTokenList.length,
        parent_token_count: parentTokenList.length,
      });
    } else {
      const note =
        childTokenList.length === 0 && row.event_type === "task_assigned"
          ? "child has no push_tokens row"
          : parentTokenList.length === 0
            ? "parent has no push_tokens row — open parent app and allow notifications"
            : "no push token for target user";
      if (!isUninstall) processedIds.push(row.id);
      results.push({
        outbox_id: row.id,
        event_type: row.event_type,
        status: isUninstall ? "pending" : "no_tokens",
        child_user_id: childUserId,
        child_token_count: childTokenList.length,
        parent_token_count: parentTokenList.length,
        note,
      });
    }
  }

  return { messages, processedIds, results };
}

/** Apply Expo ticket results; only successful outbox rows should be marked processed. */
function applyExpoTicketsToResults(
  results: RowResult[],
  messages: OutboxExpoMsg[],
  tickets: ExpoTicket[],
): number[] {
  const byOutbox = new Map(results.map((r) => [r.outbox_id, r]));
  const successOutbox = new Set<number>();

  const n = Math.min(messages.length, tickets.length);
  for (let j = 0; j < n; j++) {
    const msg = messages[j];
    const ticket = tickets[j];
    const outboxId = msg.outboxId;
    if (outboxId == null) continue;

    const row = byOutbox.get(outboxId);
    if (!row || row.status === "pending") continue;

    const prefix = msg.to.length > 28 ? `${msg.to.slice(0, 28)}…` : msg.to;
    row.target_token_prefix = prefix;

    if (ticket.status === "ok") {
      row.expo_ticket = "ok";
      row.status = "sent";
      successOutbox.add(outboxId);
    } else if (row.status === "queued") {
      row.expo_ticket = "error";
      row.status = "expo_error";
      row.expo_error = ticket.message ?? ticket.details?.error ?? "Expo push error";
      row.note = `Expo rejected push: ${row.expo_error}`;
    }
  }

  return [...successOutbox];
}

async function markProcessed(supabase: SupabaseClient, ids: number[]) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;
  await supabase
    .from("notification_outbox")
    .update({ processed_at: new Date().toISOString() })
    .in("id", unique);
}

async function parseRequestBody(req: Request): Promise<{ checkChildTokens: boolean }> {
  if (req.method === "GET" || req.method === "HEAD") return { checkChildTokens: false };
  const text = await req.text();
  if (!text.trim()) return { checkChildTokens: false };
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

  const { checkChildTokens: checkChildTokensRequested } = await parseRequestBody(req);
  const supabase = createClient(supabaseUrl, serviceKey);

  // Only ping child tokens when explicitly requested (cron / parent RPC Test). Not on every task push.
  const healthCheck = checkChildTokensRequested ? await checkChildPushTokens(supabase) : null;

  const allResults: RowResult[] = [];
  const allTickets: ExpoTicket[] = [];
  const allProcessedIds: number[] = [];
  let totalMessages = 0;
  let totalRevoked = 0;
  let totalUninstallHandled = healthCheck?.uninstall_handled ?? 0;
  let outboxPasses = 0;

  try {
    for (let pass = 0; pass < 3; pass++) {
      const drain = await buildOutboxDrain(supabase);
      const hasWork = drain.messages.length > 0 || drain.processedIds.length > 0;
      if (pass > 0 && !hasWork) break;
      if (!hasWork) continue;

      outboxPasses += 1;
      const { tickets, revoked, uninstallHandled, confirmedOutboxIds } =
        await sendMessagesAndRevokeInvalid(supabase, drain.messages);

      const sentOutboxIds = applyExpoTicketsToResults(drain.results, drain.messages, tickets);
      const idsToMark = [...new Set([...drain.processedIds, ...sentOutboxIds, ...confirmedOutboxIds])];
      allTickets.push(...tickets);
      allResults.push(...drain.results);
      allProcessedIds.push(...idsToMark);
      totalMessages += drain.messages.length;
      totalRevoked += revoked.length;
      totalUninstallHandled += uninstallHandled;

      await markProcessed(supabase, idsToMark);

      if (uninstallHandled > 0) continue;
      if (drain.messages.length === 0) break;
    }
  } catch (e) {
    return jsonResponse(
      { error: String(e), partial: true, health_check: healthCheck, results: allResults },
      500,
    );
  }

  return jsonResponse({
    ok: true,
    health_check: healthCheck,
    outbox_passes: outboxPasses,
    messages_sent: totalMessages,
    tokens_revoked: totalRevoked,
    uninstall_handled: totalUninstallHandled,
    results: allResults,
    hint:
      totalUninstallHandled > 0
        ? "Revoked child token(s) and sent uninstall alert to parent."
        : allResults.some((r) => r.status === "expo_error")
          ? "Expo rejected one or more pushes — see expo_error in results. Re-enable push on the parent device, then retry."
          : allResults.some((r) => r.status === "no_tokens")
            ? "No push token for target user — parent must tap Enable push on the parent phone/emulator."
            : checkChildTokensRequested
              ? "Health check ran — see health_check.tokens_checked (silent pings, no UI on child)."
              : "Outbox drained. Check results[].status (sent | expo_error | no_tokens).",
  });
});
