import { useChildAppUsageSync } from "@/hooks/useChildAppUsageSync";
import { useAuth } from "@/store/AuthContext";

/** Syncs Android app-open events to Supabase for the parent dashboard. */
export function ChildAppUsageBridge() {
  const { appMode } = useAuth();
  useChildAppUsageSync(appMode === "child");
  return null;
}
