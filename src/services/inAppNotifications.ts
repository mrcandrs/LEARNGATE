import { supabase } from "@/services/supabase";

export type UserNotification = {
  id: number;
  kind: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export async function fetchMyNotifications(limit = 50): Promise<UserNotification[]> {
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from("user_notifications")
    .select("id, kind, title, body, data, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (__DEV__) {
      console.warn("[notifications] fetch:", error.message);
    }
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id as number,
    kind: row.kind as string,
    title: row.title as string,
    body: row.body as string,
    data: (row.data as Record<string, unknown>) ?? {},
    read_at: (row.read_at as string | null) ?? null,
    created_at: row.created_at as string,
  }));
}

export async function markNotificationRead(id: number): Promise<void> {
  if (!supabase) {
    return;
  }
  const { error } = await supabase
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);

  if (error && __DEV__) {
    console.warn("[notifications] mark read:", error.message);
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  if (!supabase) {
    return;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return;
  }

  const { error } = await supabase
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);

  if (error && __DEV__) {
    console.warn("[notifications] mark all read:", error.message);
  }
}

/** Ask the server to drain notification_outbox (helps when auto-dispatch SQL is not applied). */
export async function requestNotificationDispatch(): Promise<void> {
  if (!supabase) {
    return;
  }
  const { error } = await supabase.rpc("request_notification_dispatch");
  if (error && __DEV__) {
    console.warn("[notifications] dispatch:", error.message);
  }
}
