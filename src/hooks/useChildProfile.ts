import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Platform } from "react-native";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/store/AuthContext";
import { syncBlockedPackages } from "@/services/appBlocking";
import { fetchChildProfileForCurrentUser } from "@/services/childProfileFetch";

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

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      return;
    }
    const client = supabase;

    let active = true;
    let channel: ReturnType<typeof client.channel> | null = null;

    async function subscribeToChildRow() {
      const {
        data: { user },
      } = await client.auth.getUser();
      if (!active || !user) {
        return;
      }

      channel = client
        .channel(`child-profile-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "children",
            filter: `child_user_id=eq.${user.id}`,
          },
          () => {
            void refresh(true);
          }
        )
        .subscribe();
    }

    void subscribeToChildRow();

    return () => {
      active = false;
      if (channel) {
        void client.removeChannel(channel);
      }
    };
  }, [isSupabaseConfigured, refresh]);

  useEffect(() => {
    if (Platform.OS !== "android" || !child?.id) {
      return;
    }
    const pkgs = child.blocked_apps_json ?? [];
    void syncBlockedPackages(pkgs);
  }, [child?.id, JSON.stringify(child?.blocked_apps_json ?? [])]);

  return { child, loading, error, refresh };
}
