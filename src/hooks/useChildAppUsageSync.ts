import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { fetchChildProfileForCurrentUser } from "@/services/childProfileFetch";
import { isUsageStatsAvailable } from "@/services/appUsageStats";
import { syncChildAppUsageEvents } from "@/services/childAppUsageSync";
import { useAuth } from "@/store/AuthContext";

const SYNC_INTERVAL_MS = 30 * 1000;

/** Periodically syncs Android Usage Stats to Supabase while the child session is active. */
export function useChildAppUsageSync(enabled: boolean) {
  const { isSupabaseConfigured } = useAuth();
  const [childId, setChildId] = useState<string | null>(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured) {
      setChildId(null);
      return;
    }
    let active = true;
    const load = async () => {
      const { child } = await fetchChildProfileForCurrentUser();
      if (active) setChildId(child?.id ?? null);
    };
    void load();
    return () => {
      active = false;
    };
  }, [enabled, isSupabaseConfigured]);

  const runSync = useCallback(async () => {
    if (!enabled || Platform.OS !== "android" || !isUsageStatsAvailable() || !childId) {
      return;
    }
    if (syncingRef.current) return;
    syncingRef.current = true;
    try {
      await syncChildAppUsageEvents(childId);
    } finally {
      syncingRef.current = false;
    }
  }, [enabled, childId]);

  useEffect(() => {
    if (!enabled || !childId) return;
    void runSync();
    const timer = setInterval(() => void runSync(), SYNC_INTERVAL_MS);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void fetchChildProfileForCurrentUser().then(({ child }) => {
          if (child?.id) setChildId(child.id);
        });
        void runSync();
      }
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [enabled, childId, runSync]);
}
