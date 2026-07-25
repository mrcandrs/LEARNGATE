import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Platform } from "react-native";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/store/AuthContext";
import { syncNativeChildBlockPolicy } from "@/services/appBlocking";
import { fetchChildProfileForCurrentUser } from "@/services/childProfileFetch";
import { subscribeChildProfileRefresh } from "@/services/childProfileEvents";
import { cacheChildProfile, readCachedChildProfile } from "@/services/offlineCache";
import { OFFLINE_MSG } from "@/services/offlineMessages";

export type { ChildProfileRow } from "@/types/child";
import type { ChildProfileRow } from "@/types/child";

export function useChildProfile() {
  const { isSupabaseConfigured } = useAuth();
  const [child, setChild] = useState<ChildProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Soft notice when showing cached data (not a hard failure). */
  const [offlineNotice, setOfflineNotice] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const childRef = useRef<ChildProfileRow | null>(null);
  childRef.current = child;

  const refresh = useCallback(async (silent = false) => {
    if (!isSupabaseConfigured || !supabase) {
      setChild(null);
      setFromCache(false);
      setOfflineNotice(null);
      setLoading(false);
      return;
    }

    if (!silent) {
      setLoading(true);
    }
    setError(null);

    // Show last saved profile immediately (helps offline / slow network).
    if (!silent || !childRef.current) {
      const cached = await readCachedChildProfile();
      if (cached) {
        setChild(cached);
        setFromCache(true);
        if (!silent) setLoading(false);
      }
    }

    const { child: row, error: fetchError } = await fetchChildProfileForCurrentUser();
    if (row) {
      setChild(row);
      setFromCache(false);
      setOfflineNotice(null);
      setError(null);
      void cacheChildProfile(row);
    } else if (fetchError) {
      const cached = childRef.current ?? (await readCachedChildProfile());
      if (cached) {
        setChild(cached);
        setFromCache(true);
        setOfflineNotice(OFFLINE_MSG.profile);
        setError(null);
      } else {
        setOfflineNotice(null);
        setError(fetchError);
      }
    }
    setLoading(false);
  }, [isSupabaseConfigured]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      void refresh(true);
    }, [refresh])
  );

  useEffect(() => subscribeChildProfileRefresh(() => void refresh(true)), [refresh]);

  useEffect(() => {
    if (Platform.OS !== "android" || !child?.id) {
      return;
    }
    void syncNativeChildBlockPolicy(child.blocked_apps_json ?? [], child.temp_unlocks ?? []);
  }, [
    child?.id,
    JSON.stringify(child?.blocked_apps_json ?? []),
    JSON.stringify(child?.temp_unlocks ?? []),
  ]);

  return { child, loading, error, offlineNotice, refresh, fromCache };
}
