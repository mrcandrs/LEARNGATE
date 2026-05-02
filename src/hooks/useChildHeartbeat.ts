import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { setChildOnlineStatus } from "@/services/childPresence";

export function useChildHeartbeat(params: { enabled: boolean; intervalMs?: number }) {
  const intervalMs = params.intervalMs ?? 60_000;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!params.enabled) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const start = () => {
      if (timerRef.current) return;
      void setChildOnlineStatus(true);
      timerRef.current = setInterval(() => {
        void setChildOnlineStatus(true);
      }, intervalMs);
    };

    const stop = () => {
      if (!timerRef.current) return;
      clearInterval(timerRef.current);
      timerRef.current = null;
    };

    start();

    const sub = AppState.addEventListener("change", (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (prev.match(/inactive|background/) && next === "active") {
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
  }, [params.enabled, intervalMs]);
}

