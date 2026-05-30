import { useCallback, useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { hasMyPushToken, registerAndSavePushToken } from "@/services/pushNotifications";

/**
 * Keeps push_tokens in sync for the signed-in role (parent or child).
 * When refreshOnForeground is true (parent), re-saves the device token on every resume so
 * the parent account keeps the token after a child session on the same phone.
 */
export function useEnsurePushToken(enabled: boolean, options?: { refreshOnForeground?: boolean }) {
  const refreshOnForeground = options?.refreshOnForeground ?? false;
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const syncingRef = useRef(false);

  const sync = useCallback(async () => {
    if (!enabled || syncingRef.current) {
      return;
    }
    syncingRef.current = true;
    try {
      const saved = await hasMyPushToken();
      if (!saved || refreshOnForeground) {
        const result = await registerAndSavePushToken();
        if (!result.ok && __DEV__) {
          console.warn("[push] ensure token:", result.message);
        }
      }
    } finally {
      syncingRef.current = false;
    }
  }, [enabled, refreshOnForeground]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    void sync();
  }, [enabled, sync]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const sub = AppState.addEventListener("change", (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (next === "active" && prev.match(/inactive|background/)) {
        void sync();
      }
    });
    return () => sub.remove();
  }, [enabled, sync]);
}
