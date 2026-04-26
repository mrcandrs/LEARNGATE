import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/store/AuthContext";
import { formatAppError } from "@/utils/errors";

export type ChildProfileRow = {
  id: string;
  name: string;
  age: number;
  difficulty_level: number;
  stars: number;
  daily_limit_minutes: number;
  avatar_url: string | null;
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
      .select("id, name, age, difficulty_level, stars, daily_limit_minutes, avatar_url")
      .eq("child_user_id", user.id)
      .maybeSingle();

    if (childError || !data) {
      setError(childError ? formatAppError(childError) : "No child profile linked to this account.");
      setChild(null);
      setLoading(false);
      return;
    }

    setChild(data as ChildProfileRow);
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

  return { child, loading, error, refresh };
}
