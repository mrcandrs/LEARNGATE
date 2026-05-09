import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { Button, Dialog, Portal, Text } from "react-native-paper";
import { labelForBlockedPackage } from "@/constants/blockedAppPackages";
import { consumePendingBlockedPackage, isAppBlockingAvailable } from "@/services/appBlocking";
import { useAuth } from "@/store/AuthContext";
/** Modal after the native blocker returns the child to LearnGate — clearer than a Snackbar. */
export function BlockedReturnDialog() {
  const { appMode } = useAuth();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const timeoutIdsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearRetryTimeouts = useCallback(() => {
    timeoutIdsRef.current.forEach(clearTimeout);
    timeoutIdsRef.current = [];
  }, []);

  const tryShowPending = useCallback(async () => {
    if (!isAppBlockingAvailable() || Platform.OS !== "android" || appMode !== "child") {
      return;
    }
    const pkg = await consumePendingBlockedPackage();
    if (!pkg) return;

    const friendly = labelForBlockedPackage(pkg);
    const body =
      friendly !== pkg ? `${friendly} is blocked — your parent locked this app.` : `"${friendly}" was blocked.`;

    setMessage(body);
    setVisible(true);
  }, [appMode]);

  const dismiss = () => setVisible(false);

  /** Burst of reads: native prefs + JS resume can race; Snackbar missed this sometimes. */
  const scheduleBurst = useCallback(() => {
    clearRetryTimeouts();
    void tryShowPending();
    ;[80, 200, 450, 900].forEach((ms) => {
      timeoutIdsRef.current.push(setTimeout(() => void tryShowPending(), ms));
    });
  }, [clearRetryTimeouts, tryShowPending]);

  useEffect(() => {
    if (appMode !== "child" || Platform.OS !== "android") return;

    scheduleBurst();

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") scheduleBurst();
    });

    return () => {
      clearRetryTimeouts();
      sub.remove();
      setVisible(false);
    };
  }, [appMode, scheduleBurst, clearRetryTimeouts]);

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={dismiss} dismissable={false} dismissableBackButton>
        <Dialog.Icon icon="shield-lock-outline" />
        <Dialog.Title>App blocked</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium">{message}</Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button mode="contained-tonal" onPress={dismiss}>
            OK
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
