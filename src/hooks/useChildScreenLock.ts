import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import { useAuth } from "@/store/AuthContext";
import type { ChildProfileRow } from "@/types/child";
import { fetchChildProfileForCurrentUser } from "@/services/childProfileFetch";
import { supabase } from "@/services/supabase";
import {
  addCountableMs,
  buildSnapshot,
  canTrackScreenTime,
  getTodayUsageMinutes,
  minutesIncludingSession,
  resetUsageForEpoch,
  sessionStartAfterEpoch,
  type ScreenLimitSnapshot,
} from "@/services/childScreenTimeUsage";
import { formatTimeLabel, isInBedtimeWindow } from "@/utils/bedtime";

export type ChildLockReason = "bedtime" | "daily_limit";

export type ChildLockState = {
  isLocked: boolean;
  reason: ChildLockReason | null;
  title: string;
  message: string;
  minutesUsedToday: number;
  dailyLimitMinutes: number;
  bedtimeStart: string;
  bedtimeEnd: string;
};

const TICK_MS = 5_000;

function evaluateLock(params: {
  now: Date;
  minutesUsed: number;
  dailyLimitMinutes: number;
  bedtimeStart: string;
  bedtimeEnd: string;
  screenLimitEnabled: boolean;
  bedtimeEnabled: boolean;
  trackingActive: boolean;
}): Pick<ChildLockState, "isLocked" | "reason" | "title" | "message"> {
  const {
    now,
    minutesUsed,
    dailyLimitMinutes,
    bedtimeStart,
    bedtimeEnd,
    screenLimitEnabled,
    bedtimeEnabled,
    trackingActive,
  } = params;

  if (bedtimeEnabled && isInBedtimeWindow(now, bedtimeStart, bedtimeEnd)) {
    return {
      isLocked: true,
      reason: "bedtime",
      title: "Bedtime",
      message: `LearnGate is locked until ${formatTimeLabel(bedtimeEnd)}. Rest time is from ${formatTimeLabel(bedtimeStart)} to ${formatTimeLabel(bedtimeEnd)}.`,
    };
  }

  if (screenLimitEnabled && trackingActive && minutesUsed >= dailyLimitMinutes) {
    const hours = Math.floor(dailyLimitMinutes / 60);
    const mins = dailyLimitMinutes % 60;
    const limitLabel =
      hours > 0 && mins > 0 ? `${hours}h ${mins}m` : hours > 0 ? `${hours} hour${hours === 1 ? "" : "s"}` : `${mins} minutes`;
    const usedLabel = Math.round(minutesUsed * 10) / 10;
    return {
      isLocked: true,
      reason: "daily_limit",
      title: "Screen time limit reached",
      message: `You've used today's ${limitLabel} limit (${usedLabel} min). Ask your parent if you need more time.`,
    };
  }

  return {
    isLocked: false,
    reason: null,
    title: "",
    message: "",
  };
}

export function useChildScreenLock(): ChildLockState & { loading: boolean } {
  const { appMode, isSupabaseConfigured } = useAuth();
  const [child, setChild] = useState<ChildProfileRow | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const enabled = appMode === "child" && isSupabaseConfigured;

  const [storedMinutes, setStoredMinutes] = useState(0);
  const [usageReady, setUsageReady] = useState(false);
  const [clock, setClock] = useState(() => new Date());

  const sessionStartRef = useRef<number | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const childIdRef = useRef<string | null>(null);
  const limitSnapshotRef = useRef<ScreenLimitSnapshot | null>(null);

  const dailyLimitMinutes = child?.daily_limit_minutes ?? 120;
  const screenLimitEnabled = child?.screen_limit_enabled !== false;
  const bedtimeEnabled = child?.bedtime_enabled !== false;
  const bedtimeStart = child?.bedtime_start ?? "20:00";
  const bedtimeEnd = child?.bedtime_end ?? "07:00";
  const trackingActive = canTrackScreenTime(limitSnapshotRef.current);

  const minutesUsedToday = useMemo(() => {
    const epochMs = limitSnapshotRef.current?.effectiveEpochMs ?? null;
    return minutesIncludingSession(storedMinutes, sessionStartRef.current, epochMs, clock.getTime());
  }, [storedMinutes, clock]);

  const syncSnapshot = useCallback(async (row: ChildProfileRow) => {
    const prev = limitSnapshotRef.current;
    const snapshot = buildSnapshot(row, prev);
    const prevEpoch = prev?.effectiveEpochMs ?? null;
    const nextEpoch = snapshot.effectiveEpochMs;

    limitSnapshotRef.current = snapshot;
    childIdRef.current = row.id;

    if (nextEpoch == null) {
      sessionStartRef.current = null;
      setStoredMinutes(0);
      return;
    }

    if (prev != null && prevEpoch !== nextEpoch) {
      sessionStartRef.current = null;
      await resetUsageForEpoch(row.id, nextEpoch);
      setStoredMinutes(0);
      if (AppState.currentState === "active") {
        sessionStartRef.current = nextEpoch;
      }
    } else {
      const loaded = await getTodayUsageMinutes(row.id, nextEpoch);
      setStoredMinutes(loaded);
      if (AppState.currentState === "active") {
        sessionStartRef.current = sessionStartAfterEpoch(Date.now(), nextEpoch);
      }
    }
  }, []);

  const refreshProfile = useCallback(
    async (silent = false) => {
      if (!enabled) {
        setChild(null);
        setProfileLoading(false);
        return;
      }
      if (!silent) {
        setProfileLoading(true);
      }
      const { child: row } = await fetchChildProfileForCurrentUser();
      if (row) {
        await syncSnapshot(row);
      } else {
        limitSnapshotRef.current = null;
        childIdRef.current = null;
        sessionStartRef.current = null;
        setStoredMinutes(0);
      }
      setChild(row);
      setClock(new Date());
      setProfileLoading(false);
    },
    [enabled, syncSnapshot]
  );

  const lockEval = useMemo(
    () =>
      evaluateLock({
        now: clock,
        minutesUsed: minutesUsedToday,
        dailyLimitMinutes,
        bedtimeStart,
        bedtimeEnd,
        screenLimitEnabled,
        bedtimeEnabled,
        trackingActive: canTrackScreenTime(limitSnapshotRef.current),
      }),
    [
      clock,
      minutesUsedToday,
      dailyLimitMinutes,
      bedtimeStart,
      bedtimeEnd,
      screenLimitEnabled,
      bedtimeEnabled,
      child?.screen_limit_set_at,
      child?.daily_limit_minutes,
      child?.screen_limit_enabled,
    ]
  );

  const isLockedNow = enabled && usageReady && Boolean(child?.id) && lockEval.isLocked;

  const flushSession = useCallback(async () => {
    const childId = childIdRef.current;
    const snapshot = limitSnapshotRef.current;
    const started = sessionStartRef.current;
    const epochMs = snapshot?.effectiveEpochMs ?? null;

    if (!childId || !snapshot || started == null || epochMs == null) {
      return;
    }

    const now = Date.now();
    const elapsedMs = now - Math.max(started, epochMs);
    sessionStartRef.current = now;

    if (elapsedMs < 1000) {
      return;
    }

    const total = await addCountableMs(childId, epochMs, elapsedMs);
    setStoredMinutes(total);
  }, []);

  const startSession = useCallback(() => {
    const epochMs = limitSnapshotRef.current?.effectiveEpochMs ?? null;
    if (epochMs == null || !canTrackScreenTime(limitSnapshotRef.current)) {
      sessionStartRef.current = null;
      return;
    }
    sessionStartRef.current = sessionStartAfterEpoch(Date.now(), epochMs);
  }, []);

  useEffect(() => {
    void refreshProfile().finally(() => setUsageReady(true));
  }, [refreshProfile]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        void refreshProfile(true);
      }
    });
    return () => sub.remove();
  }, [enabled, refreshProfile]);

  useEffect(() => {
    const client = supabase;
    if (!enabled || !client) {
      return;
    }
    let active = true;
    let channel: ReturnType<typeof client.channel> | null = null;

    async function subscribe() {
      const {
        data: { user },
      } = await client.auth.getUser();
      if (!active || !user) {
        return;
      }
      channel = client
        .channel(`child-screen-lock-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "children",
            filter: `child_user_id=eq.${user.id}`,
          },
          () => {
            void refreshProfile(true);
            setClock(new Date());
          }
        )
        .subscribe();
    }

    void subscribe();
    return () => {
      active = false;
      if (channel) {
        void client.removeChannel(channel);
      }
    };
  }, [enabled, refreshProfile]);

  useEffect(() => {
    if (!enabled || !child?.id || !usageReady) {
      return;
    }

    if (appStateRef.current === "active" && !isLockedNow) {
      startSession();
    }

    const tick = setInterval(() => {
      setClock(new Date());
      if (appStateRef.current === "active" && sessionStartRef.current != null && !isLockedNow) {
        void flushSession();
      }
    }, TICK_MS);

    const sub = AppState.addEventListener("change", (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (next === "active" && prev.match(/inactive|background/)) {
        setClock(new Date());
        if (!isLockedNow) {
          startSession();
        }
      }
      if (next.match(/inactive|background/) && prev === "active") {
        void flushSession().finally(() => {
          sessionStartRef.current = null;
        });
      }
    });

    return () => {
      clearInterval(tick);
      sub.remove();
      if (appStateRef.current === "active") {
        void flushSession();
      }
    };
  }, [child?.id, enabled, flushSession, usageReady, isLockedNow, startSession]);

  useEffect(() => {
    if (!enabled || !usageReady) {
      return;
    }
    if (isLockedNow) {
      void flushSession();
      sessionStartRef.current = null;
    } else if (appStateRef.current === "active" && child?.id) {
      startSession();
    }
  }, [isLockedNow, enabled, usageReady, flushSession, child?.id, startSession]);

  return {
    loading: profileLoading || (enabled && !usageReady),
    isLocked: isLockedNow,
    reason: isLockedNow ? lockEval.reason : null,
    title: lockEval.title,
    message: lockEval.message,
    minutesUsedToday: Math.round(minutesUsedToday * 10) / 10,
    dailyLimitMinutes,
    bedtimeStart,
    bedtimeEnd,
  };
}
