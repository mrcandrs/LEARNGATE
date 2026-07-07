import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform, StyleSheet, View } from "react-native";
import { Button, Dialog, Portal, RadioButton, Text, TextInput, useTheme } from "react-native-paper";
import { labelForBlockedPackage } from "@/constants/blockedAppPackages";
import { UNLOCK_DURATIONS, type TempUnlockRow, type UnlockDuration } from "@/constants/appUnlock";
import {
  consumePendingBlockedPackage,
  isAppBlockingAvailable,
  launchAppPackage,
} from "@/services/appBlocking";
import {
  activateAppUnlock,
  fetchChildTempUnlocks,
  fetchPendingUnlockForPackage,
  fetchUnlockQuote,
  requestAppUnlock,
} from "@/services/appUnlock";
import { ensurePackageAllowedOnNative, flushTempUnlocksToNative } from "@/services/appUnlockNativeSync";
import { fetchChildProfileForCurrentUser } from "@/services/childProfileFetch";
import {
  emitChildProfileRefresh,
  subscribeChildProfileRefresh,
} from "@/services/childProfileEvents";
import { unlockRowForPackage } from "@/utils/appUnlockTime";
import { useAuth } from "@/store/AuthContext";
import type { ChildProfileRow } from "@/types/child";
import { useAppColors } from "@/theme/useAppColors";

/** Modal when the native blocker returns the child to LearnGate for a blocked app. */
export function BlockedReturnDialog() {
  const { appMode } = useAuth();
  const theme = useTheme();
  const c = useAppColors();
  const [child, setChild] = useState<ChildProfileRow | null>(null);
  const childRef = useRef<ChildProfileRow | null>(null);
  childRef.current = child;

  const [visible, setVisible] = useState(false);
  const [blockedPkg, setBlockedPkg] = useState<string | null>(null);
  const [duration, setDuration] = useState<UnlockDuration>("30m");
  const [quotes, setQuotes] = useState<Partial<Record<UnlockDuration, number>>>({});
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteDisabled, setQuoteDisabled] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const timeoutIdsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lastRelaunchRef = useRef<Record<string, number>>({});

  const refreshChild = useCallback(async () => {
    const { child: row } = await fetchChildProfileForCurrentUser();
    setChild(row);
    childRef.current = row;
    return row;
  }, []);

  const clearRetryTimeouts = useCallback(() => {
    timeoutIdsRef.current.forEach(clearTimeout);
    timeoutIdsRef.current = [];
  }, []);

  useEffect(() => {
    if (appMode !== "child") {
      setChild(null);
      childRef.current = null;
      return;
    }
    void refreshChild();
    return subscribeChildProfileRefresh(() => {
      void refreshChild();
    });
  }, [appMode, refreshChild]);

  const loadQuotes = useCallback(async (pkg: string, childId: string) => {
    setQuoteLoading(true);
    setQuoteDisabled(null);
    setError(null);
    const next: Partial<Record<UnlockDuration, number>> = {};
    let disabledReason: string | null = null;

    for (const d of UNLOCK_DURATIONS) {
      const quote = await fetchUnlockQuote(childId, pkg, d.id);
      if (quote.disabled) {
        disabledReason = quote.reason ?? "Star unlock is not available for this app.";
        break;
      }
      if (quote.ok && quote.stars != null) {
        next[d.id] = quote.stars;
      }
    }

    setQuotes(next);
    setQuoteDisabled(disabledReason);
    setQuoteLoading(false);
  }, []);

  const openUnlockedApp = useCallback(async (pkg: string, _unlockRow?: TempUnlockRow | null) => {
    // Break the bounce ↔ auto-relaunch ping-pong: if we just relaunched this app, don't slam it
    // open again. One relaunch is enough; if the child is still being bounced, let them tap back in
    // from the "Unlocked apps" card instead of flickering between LearnGate and the app.
    const now = Date.now();
    if (now - (lastRelaunchRef.current[pkg] ?? 0) < 6000) {
      return;
    }
    lastRelaunchRef.current[pkg] = now;

    const childId = childRef.current?.id;
    // Start the clock now for fixed-length passes (no-op for anchored/already-started passes),
    // then read the fresh window so we launch with the real remaining time.
    if (childId) {
      await activateAppUnlock(childId, pkg);
    }
    const freshRows = childId ? await fetchChildTempUnlocks(childId) : childRef.current?.temp_unlocks ?? [];
    const row = unlockRowForPackage(pkg, freshRows);
    if (row) {
      await ensurePackageAllowedOnNative(pkg, row, freshRows, childRef.current?.blocked_apps_json ?? []);
    } else {
      await flushTempUnlocksToNative();
    }
    const launched = await launchAppPackage(pkg, row, childRef.current?.blocked_apps_json ?? []);
    if (!launched && __DEV__) {
      console.warn("[LearnGate] Could not launch package:", pkg);
    }
    emitChildProfileRefresh();
  }, []);

  const tryShowPending = useCallback(async () => {
    if (!isAppBlockingAvailable() || Platform.OS !== "android" || appMode !== "child") {
      return;
    }
    const pkg = await consumePendingBlockedPackage();
    if (!pkg) return;

    const row = childRef.current ?? (await refreshChild());
    if (!row?.id) return;

    const unlockRow = unlockRowForPackage(pkg, row.temp_unlocks ?? []);
    if (unlockRow) {
      // Parent approved — let the child into the app instead of showing a modal here.
      await openUnlockedApp(pkg, unlockRow);
      return;
    }

    setBlockedPkg(pkg);
    setDuration("30m");
    setQuotes({});
    setQuoteDisabled(null);
    setRequestSent(false);
    setMessage("");
    setError(null);
    setVisible(true);

    const existing = await fetchPendingUnlockForPackage(row.id, pkg);
    setPending(!!existing);
    if (!existing) {
      void loadQuotes(pkg, row.id);
    }
  }, [appMode, loadQuotes, openUnlockedApp, refreshChild]);

  const tryShowPendingRef = useRef(tryShowPending);
  tryShowPendingRef.current = tryShowPending;

  useEffect(() => {
    if (!visible || !blockedPkg || !child?.id || pending || requestSent) {
      return;
    }
    void loadQuotes(blockedPkg, child.id);
  }, [visible, blockedPkg, child?.id, pending, requestSent, loadQuotes]);

  const dismiss = () => {
    setVisible(false);
    setBlockedPkg(null);
  };

  useEffect(() => {
    if (appMode !== "child" || Platform.OS !== "android") {
      return;
    }

    const scheduleBurst = () => {
      clearRetryTimeouts();
      void tryShowPendingRef.current();
      ;[80, 200, 450, 900].forEach((ms) => {
        timeoutIdsRef.current.push(setTimeout(() => void tryShowPendingRef.current(), ms));
      });
    };

    scheduleBurst();

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refreshChild();
        scheduleBurst();
      }
    });

    return () => {
      clearRetryTimeouts();
      sub.remove();
    };
  }, [appMode, clearRetryTimeouts, refreshChild]);

  const friendly = blockedPkg ? labelForBlockedPackage(blockedPkg) : "This app";
  const selectedStars = quotes[duration];
  const canAfford =
    selectedStars != null && child != null && child.stars >= selectedStars && !quoteDisabled;

  const onRequestUnlock = async () => {
    if (!child?.id || !blockedPkg || selectedStars == null) return;
    setRequestBusy(true);
    setError(null);
    const result = await requestAppUnlock({
      childId: child.id,
      packageName: blockedPkg,
      appLabel: friendly,
      duration,
      message: message.trim() || undefined,
    });
    setRequestBusy(false);
    if (!result.ok) {
      setError(result.reason ?? "Could not send request.");
      return;
    }
    setRequestSent(true);
    setPending(true);
    await refreshChild();
    emitChildProfileRefresh();
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={dismiss} dismissable={false} dismissableBackButton>
        <Dialog.Icon icon="shield-lock-outline" />
        <Dialog.Title>App blocked</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium" style={styles.body}>
            {friendly !== blockedPkg
              ? `${friendly} is blocked — your parent locked this app.`
              : `"${friendly}" was blocked.`}
          </Text>

          {pending || requestSent ? (
            <View style={[styles.pendingBox, { backgroundColor: c.surfaceTint, borderColor: c.border }]}>
              <Text variant="titleSmall" style={{ color: c.primaryDark }}>
                Waiting for parent
              </Text>
              <Text variant="bodySmall" style={{ color: c.subtext, marginTop: 4 }}>
                Your unlock request was sent. Your parent will approve or deny it. Stars are held until then.
              </Text>
            </View>
          ) : quoteDisabled ? (
            <Text variant="bodySmall" style={{ color: c.subtext, marginTop: 8 }}>
              {quoteDisabled}
            </Text>
          ) : (
            <>
              <Text variant="titleSmall" style={[styles.sectionLabel, { color: c.primaryDark }]}>
                Ask parent with stars
              </Text>
              <Text variant="bodySmall" style={{ color: c.subtext, marginBottom: 8 }}>
                You have {child?.stars ?? 0} stars this week. Stars are returned if your parent says no.
              </Text>

              {quoteLoading ? (
                <Text variant="bodySmall" style={{ color: c.subtext }}>
                  Loading prices…
                </Text>
              ) : (
                <RadioButton.Group onValueChange={(v) => setDuration(v as UnlockDuration)} value={duration}>
                  {UNLOCK_DURATIONS.map((d) => {
                    const stars = quotes[d.id];
                    const affordable = stars != null && (child?.stars ?? 0) >= stars;
                    return (
                      <RadioButton.Item
                        key={d.id}
                        label={`${d.label} — ${stars ?? "?"} ★`}
                        value={d.id}
                        disabled={stars == null || !affordable}
                        labelStyle={{ color: affordable ? c.text : c.subtext }}
                      />
                    );
                  })}
                </RadioButton.Group>
              )}

              <TextInput
                mode="outlined"
                label="Note for parent (optional)"
                value={message}
                onChangeText={setMessage}
                maxLength={120}
                style={styles.noteInput}
              />

              {error ? (
                <Text variant="bodySmall" style={{ color: theme.colors.error, marginTop: 6 }}>
                  {error}
                </Text>
              ) : null}
            </>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Button mode="text" onPress={dismiss}>
            OK
          </Button>
          {!pending && !requestSent && !quoteDisabled && !quoteLoading ? (
            <Button mode="contained" onPress={() => void onRequestUnlock()} loading={requestBusy} disabled={!canAfford}>
              Request unlock
            </Button>
          ) : null}
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  body: {
    marginBottom: 4,
  },
  sectionLabel: {
    marginTop: 12,
    marginBottom: 4,
    fontWeight: "700",
  },
  pendingBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  noteInput: {
    marginTop: 4,
  },
});
