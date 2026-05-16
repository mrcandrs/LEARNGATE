import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { supabase } from "@/services/supabase";
/**
 * Subscribes to new tasks for the signed-in child (Realtime).
 * Push alerts are sent by Supabase (notification_outbox + edge function) — no local
 * duplicate notification here (that caused 2 alerts per new task).
 * Does not use useChildProfile — must work outside NavigationContainer.
 */
export function useChildTaskAlerts(enabled: boolean) {
  const [childId, setChildId] = useState<string | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const seenTaskIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!enabled || !supabase) {
      setChildId(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) {
        return;
      }

      const { data } = await supabase.from("children").select("id").eq("child_user_id", user.id).maybeSingle();

      if (!cancelled) {
        setChildId(data?.id ?? null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !supabase || !childId) {
      return;
    }

    let channel: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;

    void (async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id")
        .eq("child_id", childId)
        .in("status", ["pending", "in_progress"]);

      seenTaskIds.current = new Set((data ?? []).map((r) => r.id));

      channel = supabase
        .channel(`child-task-alerts-${childId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "tasks",
            filter: `child_id=eq.${childId}`,
          },
          (payload) => {
            const row = payload.new as { id?: string; title?: string; status?: string };
            if (!row.id || row.status !== "pending") {
              return;
            }
            if (seenTaskIds.current.has(row.id)) {
              return;
            }
            seenTaskIds.current.add(row.id);

            if (__DEV__) {
              console.log("[push] new task detected (server will push)", {
                id: row.id,
                title: row.title,
              });
            }
          }
        )
        .subscribe((status) => {
          if (__DEV__) {
            console.log("[push] child task realtime:", status);
          }
        });
    })();

    return () => {
      if (channel && supabase) {
        void supabase.removeChannel(channel);
      }
    };
  }, [enabled, childId]);
}
