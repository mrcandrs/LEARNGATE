import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { useChildAppUsageSync } from "@/hooks/useChildAppUsageSync";
import { useChildProfileRealtimeSync } from "@/hooks/useChildProfileRealtimeSync";
import { flushTempUnlocksToNative } from "@/services/appUnlockNativeSync";
import { useAuth } from "@/store/AuthContext";

/** Syncs Android app-open events to Supabase for the parent dashboard. */
export function ChildAppUsageBridge() {
  const { appMode } = useAuth();
  const isChild = appMode === "child";
  useChildAppUsageSync(isChild);
  useChildProfileRealtimeSync(isChild);

  useEffect(() => {
    if (!isChild || Platform.OS !== "android") {
      return;
    }
    void flushTempUnlocksToNative();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void flushTempUnlocksToNative();
      }
    });
    return () => sub.remove();
  }, [isChild]);

  return null;
}
