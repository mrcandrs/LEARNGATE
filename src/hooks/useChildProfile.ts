import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Platform } from "react-native";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/store/AuthContext";
import { syncBlockedPackages } from "@/services/appBlocking";
import { formatAppError } from "@/utils/errors";

export type ChildProfileRow = {
  id: string;
  name: string;
  age: number;
  difficulty_level: number;
  stars: number;
  daily_limit_minutes: number;
  avatar_url: string | null;
  audio_guide_enabled: boolean;
  audio_guide_rate: number;
  /** Package names the parent chose to block (from `screen_rules.blocked_apps_json`). */
  blocked_apps_json: string[];
};

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

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError(formatAppError(userError ?? new Error("Not signed in.")));
      setChild(null);
      setLoading(false);
      return;
    }

    const { data, error: childError } = await supabase
      .from("children")
      .select("id, name, age, difficulty_level, stars, daily_limit_minutes, avatar_url, audio_guide_enabled, audio_guide_rate")
      .eq("child_user_id", user.id)
      .maybeSingle();

    if (childError || !data) {
      setError(childError ? formatAppError(childError) : "No child profile linked to this account.");
      setChild(null);
      setLoading(false);
      return;
    }

    const { data: ruleRow, error: ruleError } = await supabase
      .from("screen_rules")
      .select("blocked_apps_json")
      .eq("child_id", data.id)
      .maybeSingle();

    if (ruleError) {
      setError(formatAppError(ruleError));
    }

    const blocked = Array.isArray(ruleRow?.blocked_apps_json) ? ruleRow!.blocked_apps_json : [];

    setChild({
      ...(data as ChildProfileRow),
      blocked_apps_json: blocked.filter((p): p is string => typeof p === "string" && p.length > 0),
    });
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
