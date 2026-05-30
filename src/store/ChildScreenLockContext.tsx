import { createContext, useContext, type ReactNode } from "react";
import { BackHandler, Platform, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect } from "react";
import { useChildScreenLock, type ChildLockState } from "@/hooks/useChildScreenLock";
import { setChildSystemNavLocked } from "@/services/childAppPin";
import { useAppColors } from "@/theme/useAppColors";
import { colors } from "@/theme/theme";

type ChildScreenLockContextValue = ChildLockState & { loading: boolean };

const ChildScreenLockContext = createContext<ChildScreenLockContextValue | null>(null);

function LockOverlay({ lock }: { lock: ChildScreenLockContextValue }) {
  const c = useAppColors();
  useEffect(() => {
    if (!lock.isLocked) {
      return;
    }
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, [lock.isLocked]);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }
    void setChildSystemNavLocked(lock.isLocked);
    return () => {
      void setChildSystemNavLocked(false);
    };
  }, [lock.isLocked]);

  if (!lock.isLocked) {
    return null;
  }

  const iconName = lock.reason === "bedtime" ? "weather-night" : "timer-lock-outline";

  return (
    <View style={styles.overlay} pointerEvents="auto" accessibilityViewIsModal importantForAccessibility="yes">
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: c.card }]}>
          <View style={[styles.iconWrap, { backgroundColor: c.surfaceTint }]}>
            <MaterialCommunityIcons name={iconName} size={40} color={colors.roleSelectGreen} />
          </View>
          <Text style={[styles.title, { color: c.text }]}>{lock.title}</Text>
          <Text style={[styles.message, { color: c.subtext }]}>{lock.message}</Text>
          <View style={[styles.statsBox, { backgroundColor: c.mutedSurface }]}>
            <Text style={[styles.statsLine, { color: c.text }]}>
              Today: {lock.minutesUsedToday} / {lock.dailyLimitMinutes} min
            </Text>
            <Text style={[styles.statsLine, { color: c.text }]}>
              Bedtime: {lock.bedtimeStart.slice(0, 5)} – {lock.bedtimeEnd.slice(0, 5)}
            </Text>
          </View>
          <Text style={[styles.footer, { color: c.subtext }]}>
            LearnGate is locked. Your parent set these limits in Manage Children. If you can still leave the app, ask
            your parent to turn on LearnGate in Settings → Accessibility on this phone, then rebuild the app after
            updates.
          </Text>
        </View>
      </View>
    </View>
  );
}

/** Single lock instance for child tabs + full-screen blocker (includes tab bar). */
export function ChildScreenLockProvider({ children }: { children: ReactNode }) {
  const lock = useChildScreenLock();

  return (
    <ChildScreenLockContext.Provider value={lock}>
      <View style={styles.root}>
        {children}
        <LockOverlay lock={lock} />
      </View>
    </ChildScreenLockContext.Provider>
  );
}

export function useChildScreenLockContext(): ChildScreenLockContextValue {
  const ctx = useContext(ChildScreenLockContext);
  if (!ctx) {
    throw new Error("useChildScreenLockContext must be used within ChildScreenLockProvider");
  }
  return ctx;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.92)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingVertical: 26,
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  statsBox: {
    width: "100%",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 4,
    marginTop: 4,
  },
  statsLine: {
    fontSize: 13,
    textAlign: "center",
  },
  footer: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
});
