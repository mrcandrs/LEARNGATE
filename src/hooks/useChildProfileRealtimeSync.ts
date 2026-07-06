import { useEffect, useState } from "react";
import { supabase } from "@/services/supabase";
import { emitChildProfileRefresh } from "@/services/childProfileEvents";
import { flushTempUnlocksToNative } from "@/services/appUnlockNativeSync";

/**
 * One realtime subscription per child session (avoids duplicate channel names when
 * several screens mount useChildProfile). Must run inside child app mode only.
 */
export function useChildProfileRealtimeSync(enabled: boolean) {
  const [childId, setChildId] = useState<string | null>(null);

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

    const client = supabase;
    const channel = client
      .channel(`child-profile-sync-${childId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "children",
          filter: `id=eq.${childId}`,
        },
        () => {
          emitChildProfileRefresh();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "child_app_temp_unlocks",
          filter: `child_id=eq.${childId}`,
        },
        () => {
          void flushTempUnlocksToNative();
          emitChildProfileRefresh();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "child_app_unlock_requests",
          filter: `child_id=eq.${childId}`,
        },
        () => {
          void flushTempUnlocksToNative();
          emitChildProfileRefresh();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "screen_rules",
          filter: `child_id=eq.${childId}`,
        },
        () => {
          void flushTempUnlocksToNative();
          emitChildProfileRefresh();
        }
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [enabled, childId]);
}
