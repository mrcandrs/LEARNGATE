/// <reference path="../deno-shim.d.ts" />
/**
 * Permanently deletes the authenticated parent's account and linked child login accounts.
 *
 * POST { "confirmation": "DELETE" }
 * Authorization: Bearer <parent JWT>
 *
 * Deploy: npx supabase functions deploy delete-parent-account
 */
// @ts-expect-error Deno resolves npm: specifiers at deploy time
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const CONFIRMATION_PHRASE = "DELETE";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
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

    let body: { confirmation?: string } = {};
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    if (body.confirmation?.trim() !== CONFIRMATION_PHRASE) {
      return jsonResponse({ error: `Type ${CONFIRMATION_PHRASE} to confirm account deletion.` }, 400);
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

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Profile read error:", profileError.message);
      return jsonResponse({ error: "Could not verify account." }, 500);
    }

    if (profile?.role !== "parent") {
      return jsonResponse({ error: "Only parent accounts can be deleted here." }, 403);
    }

    const { data: children, error: childrenError } = await admin
      .from("children")
      .select("child_user_id")
      .eq("parent_id", user.id);

    if (childrenError) {
      console.error("Children read error:", childrenError.message);
      return jsonResponse({ error: "Could not load child accounts." }, 500);
    }

    const childUserIds = [
      ...new Set(
        (children ?? [])
          .map((row) => row.child_user_id as string | null)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    for (const childUserId of childUserIds) {
      const { error: childDeleteError } = await admin.auth.admin.deleteUser(childUserId);
      if (childDeleteError && !/not found|user not found/i.test(childDeleteError.message)) {
        console.error("Child auth delete error:", childUserId, childDeleteError.message);
        return jsonResponse({ error: "Could not remove a child login account." }, 500);
      }
    }

    const { error: parentDeleteError } = await admin.auth.admin.deleteUser(user.id);
    if (parentDeleteError) {
      console.error("Parent auth delete error:", parentDeleteError.message);
      return jsonResponse({ error: "Could not delete parent account." }, 500);
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error("delete-parent-account error:", err);
    return jsonResponse({ error: "Unexpected server error." }, 500);
  }
});
