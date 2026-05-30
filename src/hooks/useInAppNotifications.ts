import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import { supabase } from "@/services/supabase";
import {
  fetchMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  requestNotificationDispatch,
  type UserNotification,
} from "@/services/inAppNotifications";

export function useInAppNotifications(enabled: boolean) {
  const [items, setItems] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const dispatchingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const rows = await fetchMyNotifications();
      setItems(rows);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const nudgePushDispatch = useCallback(async () => {
    if (!enabled || dispatchingRef.current) {
      return;
    }
    dispatchingRef.current = true;
    try {
      await requestNotificationDispatch();
    } finally {
      dispatchingRef.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    void refresh();
    void nudgePushDispatch();
  }, [enabled, refresh, nudgePushDispatch]);

  useEffect(() => {
    if (!enabled || !supabase) {
      return;
    }

    let channel: ReturnType<typeof supabase.channel> | null = null;

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || !supabase) {
        return;
      }
      channel = supabase
        .channel(`user_notifications:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "user_notifications",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            void refresh();
          }
        )
        .subscribe();
    });

    return () => {
      if (channel && supabase) {
        void supabase.removeChannel(channel);
      }
    };
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const appStateRef = { current: AppState.currentState };
    const sub = AppState.addEventListener("change", (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (next === "active" && prev.match(/inactive|background/)) {
        void refresh();
        void nudgePushDispatch();
      }
    });
    return () => sub.remove();
  }, [enabled, refresh, nudgePushDispatch]);

  const unreadCount = items.filter((n) => !n.read_at).length;

  const markRead = useCallback(async (id: number) => {
    await markNotificationRead(id);
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    );
  }, []);

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
  }, []);

  return {
    items,
    loading,
    unreadCount,
    refresh,
    markRead,
    markAllRead,
  };
}
