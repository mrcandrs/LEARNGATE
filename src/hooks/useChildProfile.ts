import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Platform } from "react-native";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/store/AuthContext";
import { syncNativeChildBlockPolicy } from "@/services/appBlocking";
import { fetchChildProfileForCurrentUser } from "@/services/childProfileFetch";
import { subscribeChildProfileRefresh } from "@/services/childProfileEvents";

export type { ChildProfileRow } from "@/types/child";
import type { ChildProfileRow } from "@/types/child";

export function useChildProfile() {
  const { isSupabaseConfigured } = useAuth();
  const [child, setChild] = useState<ChildProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (silent = false) => {
    if (!isSupabaseConfigured || !supabase) {
      setChild(null);
      setLoading(false);
      return;
    }

    if (!silent) {
      setLoading(true);
    }
    setError(null);

    const { child: row, error: fetchError } = await fetchChildProfileForCurrentUser();
    if (fetchError) {
      setError(fetchError);
    }
    setChild(row);
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

  return { child, loading, error, refresh };
}
