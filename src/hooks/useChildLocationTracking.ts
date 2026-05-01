import { useEffect, useRef } from "react";
import * as Location from "expo-location";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/store/AuthContext";

export function useChildLocationTracking() {
  const { isSupabaseConfigured } = useAuth();
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const childIdRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    async function startTracking() {
      if (!isSupabaseConfigured || !supabase) {
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active || !user) {
        return;
      }

      const { data: child } = await supabase
        .from("children")
        .select("id")
        .eq("child_user_id", user.id)
        .maybeSingle();
      if (!active || !child?.id) {
        return;
      }
      childIdRef.current = child.id;

      const existing = watchRef.current;
      if (existing) {
        existing.remove();
        watchRef.current = null;
      }

      const currentPermission = await Location.getForegroundPermissionsAsync();
      let status = currentPermission.status;
      if (status !== "granted" && status !== "denied") {
        const requested = await Location.requestForegroundPermissionsAsync();
        status = requested.status;
      }
      if (status !== "granted") {
        return;
      }

      watchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,
          distanceInterval: 1,
        },
        async (loc) => {
          const childId = childIdRef.current;
          if (!childId || !active || !supabase) {
            return;
          }

          await supabase.from("child_locations").insert({
            child_id: childId,
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            accuracy_m: loc.coords.accuracy ?? null,
            speed_mps: loc.coords.speed ?? null,
            heading_deg: loc.coords.heading ?? null,
            captured_at: new Date(loc.timestamp).toISOString(),
          });
        }
      );
    }

    void startTracking();

    return () => {
      active = false;
      if (watchRef.current) {
        watchRef.current.remove();
        watchRef.current = null;
      }
    };
  }, [isSupabaseConfigured]);
}

