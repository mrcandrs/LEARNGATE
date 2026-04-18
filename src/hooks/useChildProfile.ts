import { useCallback, useEffect, useState } from "react";
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

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setChild(null);
      setLoading(false);
      return;
    }

    setLoading(true);
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

  return { child, loading, error, refresh };
}
