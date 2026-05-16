import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { requestChildPushHealthCheck } from "@/services/pushNotifications";

const INTERVAL_MS = 5 * 60 * 1000;

/**
 * While the parent app is in the foreground, periodically ask the server to verify
 * child push tokens (detects uninstall / cleared app data).
 */
export function useParentChildPushHealthCheck(enabled: boolean) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const run = () => {
      void requestChildPushHealthCheck();
    };

    const start = () => {
      if (timerRef.current) return;
      run();
      timerRef.current = setInterval(run, INTERVAL_MS);
    };

    const stop = () => {
      if (!timerRef.current) return;
      clearInterval(timerRef.current);
      timerRef.current = null;
    };

    if (appStateRef.current === "active") {
      start();
    }

    const sub = AppState.addEventListener("change", (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (next === "active" && prev.match(/inactive|background/)) {
        start();
      }
      if (next.match(/inactive|background/)) {
        stop();
      }
    });

    return () => {
      stop();
      sub.remove();
    };
  }, [enabled]);
}
