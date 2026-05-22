import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import { useAuth } from "@/store/AuthContext";
import type { ChildProfileRow } from "@/types/child";
import { fetchChildProfileForCurrentUser } from "@/services/childProfileFetch";
import { supabase } from "@/services/supabase";
import { addTodayUsageMinutes, getTodayUsageMinutes } from "@/services/childScreenTimeUsage";
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

const TICK_MS = 30_000;

function evaluateLock(params: {
  now: Date;
  minutesUsed: number;
  dailyLimitMinutes: number;
  bedtimeStart: string;
  bedtimeEnd: string;
}): Pick<ChildLockState, "isLocked" | "reason" | "title" | "message"> {
  const { now, minutesUsed, dailyLimitMinutes, bedtimeStart, bedtimeEnd } = params;

  if (isInBedtimeWindow(now, bedtimeStart, bedtimeEnd)) {
    return {
      isLocked: true,
      reason: "bedtime",
      title: "Bedtime",
      message: `LearnGate is locked until ${formatTimeLabel(bedtimeEnd)}. Rest time is from ${formatTimeLabel(bedtimeStart)} to ${formatTimeLabel(bedtimeEnd)}.`,
    };
  }

  if (minutesUsed >= dailyLimitMinutes) {
    const hours = Math.floor(dailyLimitMinutes / 60);
    const mins = dailyLimitMinutes % 60;
    const limitLabel =
      hours > 0 && mins > 0 ? `${hours}h ${mins}m` : hours > 0 ? `${hours} hour${hours === 1 ? "" : "s"}` : `${mins} minutes`;
    return {
      isLocked: true,
      reason: "daily_limit",
      title: "Screen time limit reached",
      message: `You've used today's ${limitLabel} limit (${minutesUsed} min). Ask your parent if you need more time.`,
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

  const [minutesUsedToday, setMinutesUsedToday] = useState(0);
  const [usageReady, setUsageReady] = useState(false);
  const [clock, setClock] = useState(() => new Date());

  const sessionStartRef = useRef<number | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const childIdRef = useRef<string | null>(null);

  const dailyLimitMinutes = child?.daily_limit_minutes ?? 120;
  const bedtimeStart = child?.bedtime_start ?? "20:00";
  const bedtimeEnd = child?.bedtime_end ?? "07:00";

  const refreshProfile = useCallback(async (silent = false) => {
    if (!enabled) {
      setChild(null);
      setProfileLoading(false);
      return;
    }
    if (!silent) {
      setProfileLoading(true);
    }
    const { child: row } = await fetchChildProfileForCurrentUser();
    setChild(row);
    setClock(new Date());
    setProfileLoading(false);
  }, [enabled]);

  const isLockedNow = useMemo(
    () =>
      enabled &&
      usageReady &&
      Boolean(child?.id) &&
      evaluateLock({
        now: clock,
        minutesUsed: minutesUsedToday,
        dailyLimitMinutes,
        bedtimeStart,
        bedtimeEnd,
      }).isLocked,
    [enabled, usageReady, child?.id, clock, minutesUsedToday, dailyLimitMinutes, bedtimeStart, bedtimeEnd]
  );

  const lockEval = useMemo(
    () =>
      evaluateLock({
        now: clock,
        minutesUsed: minutesUsedToday,
        dailyLimitMinutes,
        bedtimeStart,
        bedtimeEnd,
      }),
    [clock, minutesUsedToday, dailyLimitMinutes, bedtimeStart, bedtimeEnd]
  );

  const flushSession = useCallback(async () => {
    const childId = childIdRef.current;
    const started = sessionStartRef.current;
    if (!childId || started == null) {
      return;
    }
    if (
      evaluateLock({
        now: new Date(),
        minutesUsed: minutesUsedToday,
        dailyLimitMinutes,
        bedtimeStart,
        bedtimeEnd,
      }).isLocked
    ) {
      sessionStartRef.current = null;
      return;
    }
    const elapsedMs = Date.now() - started;
    sessionStartRef.current = Date.now();
    if (elapsedMs < 1000) {
      return;
    }
    const deltaMinutes = elapsedMs / 60_000;
    const total = await addTodayUsageMinutes(childId, deltaMinutes);
    setMinutesUsedToday(total);
  }, [minutesUsedToday, dailyLimitMinutes, bedtimeStart, bedtimeEnd]);

  const loadUsage = useCallback(async (childId: string) => {
    const total = await getTodayUsageMinutes(childId);
    setMinutesUsedToday(total);
    setUsageReady(true);
  }, []);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

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
    childIdRef.current = child?.id ?? null;
    if (!enabled || !child?.id) {
      setUsageReady(false);
      setMinutesUsedToday(0);
      sessionStartRef.current = null;
      return;
    }
    setUsageReady(false);
    void loadUsage(child.id);
  }, [child?.id, enabled, loadUsage]);

  useEffect(() => {
    if (!enabled || !child?.id || !usageReady) {
      return;
    }

    const startSession = () => {
      sessionStartRef.current = Date.now();
    };

    const stopSession = () => {
      void flushSession().then(() => {
        sessionStartRef.current = null;
      });
    };

    if (appStateRef.current === "active" && !isLockedNow) {
      startSession();
    }

    const tick = setInterval(() => {
      setClock(new Date());
      if (appStateRef.current === "active" && sessionStartRef.current != null) {
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
        stopSession();
      }
    });

    return () => {
      clearInterval(tick);
      sub.remove();
      if (appStateRef.current === "active") {
        stopSession();
      }
    };
  }, [child?.id, enabled, flushSession, usageReady, isLockedNow]);

  useEffect(() => {
    if (!enabled || !usageReady) {
      return;
    }
    if (isLockedNow) {
      void flushSession();
      sessionStartRef.current = null;
    } else if (appStateRef.current === "active" && child?.id) {
      sessionStartRef.current = Date.now();
    }
  }, [isLockedNow, enabled, usageReady, flushSession, child?.id]);

  useEffect(() => {
    if (!enabled || !childIdRef.current) {
      return;
    }
    const timer = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0 && childIdRef.current) {
        void loadUsage(childIdRef.current);
        setClock(now);
      }
    }, 60_000);
    return () => clearInterval(timer);
  }, [enabled, loadUsage]);

  return {
    loading: profileLoading || (enabled && !usageReady),
    isLocked: isLockedNow,
    reason: isLockedNow ? lockEval.reason : null,
    title: lockEval.title,
    message: lockEval.message,
    minutesUsedToday,
    dailyLimitMinutes,
    bedtimeStart,
    bedtimeEnd,
  };
}
