import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Platform, StyleSheet, View } from "react-native";
import { Button, Chip, Dialog, Portal, Switch, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { blockedAppsForDisplay } from "@/constants/blockedAppPackages";
import { useAuth } from "@/store/AuthContext";
import { radii, shadows } from "@/theme/theme";
import { useAppColors } from "@/theme/useAppColors";
import { useAudioGuidance } from "@/store/AudioGuidanceContext";
import { useThemeMode } from "@/store/ThemeModeContext";
import { useChildProfile } from "@/hooks/useChildProfile";
import { supabase } from "@/services/supabase";
import { formatAppError } from "@/utils/errors";
import { clearBlockedPackagesFromNative, getAccessibilityEnabled, isAppBlockingAvailable } from "@/services/appBlocking";
import { getUsageAccessGranted, isUsageStatsAvailable } from "@/services/appUsageStats";
import { hasLearnGateNativeModules } from "@/services/learnGateNative";

function StatusInfoRow({
  label,
  enabled,
  description,
  colors: c,
}: {
  label: string;
  enabled: boolean | null;
  description: string;
  colors: ReturnType<typeof useAppColors>;
}) {
  const statusText = enabled === null ? "Checking…" : enabled ? "On" : "Off";
  const statusColor = enabled ? c.primary : c.subtext;

  return (
    <View style={[statusStyles.card, { backgroundColor: c.mutedSurface, borderColor: c.border }]}>
      <View style={statusStyles.header}>
        <View style={[statusStyles.dot, { backgroundColor: statusColor }]} />
        <Text variant="titleSmall" style={[statusStyles.title, { color: c.text }]}>
          {label}: {statusText}
        </Text>
      </View>
      <Text variant="bodySmall" style={[statusStyles.description, { color: c.subtext }]}>
        {description}
      </Text>
    </View>
  );
}

export function ChildSettingsScreen() {
  const { signOut } = useAuth();
  const audio = useAudioGuidance();
  const { child, refresh } = useChildProfile();
  const themeMode = useThemeMode();
  const c = useAppColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessibilityOn, setAccessibilityOn] = useState<boolean | null>(null);
  const [usageAccessOn, setUsageAccessOn] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      if (Platform.OS !== "android" || !isAppBlockingAvailable()) {
        setAccessibilityOn(null);
      } else {
        void (async () => {
          const on = await getAccessibilityEnabled();
          if (active) setAccessibilityOn(on);
        })();
      }

      if (Platform.OS !== "android" || !isUsageStatsAvailable()) {
        setUsageAccessOn(null);
      } else {
        void (async () => {
          const on = await getUsageAccessGranted();
          if (active) setUsageAccessOn(on);
        })();
      }

      return () => {
        active = false;
      };
    }, [])
  );

  const blockedApps = useMemo(() => blockedAppsForDisplay(child?.blocked_apps_json ?? []), [child?.blocked_apps_json]);
  const nativeReady = hasLearnGateNativeModules();
  const showAndroidDeviceFeatures = Platform.OS === "android";

  const onToggleAudio = async (next: boolean) => {
    audio.setEnabled(next);
    if (!supabase || !child) return;
    const { error: updateError } = await supabase.from("children").update({ audio_guide_enabled: next }).eq("id", child.id);
    if (updateError) {
      setError(formatAppError(updateError));
      return;
    }
    await refresh(true);
  };

  return (
    <ScreenContainer scroll>
      <View style={styles.card}>
        <Text variant="titleMedium" style={styles.title}>
          Appearance
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Pick your color theme and display mode.
        </Text>
        <Text variant="labelLarge" style={styles.groupLabel}>
          Color theme
        </Text>
        <View style={styles.chipRow}>
          <Chip selected={themeMode.mode === "mint"} onPress={() => themeMode.setMode("mint")}>
            Mint
          </Chip>
          <Chip selected={themeMode.mode === "sunset"} onPress={() => themeMode.setMode("sunset")}>
            Sunset
          </Chip>
          <Chip selected={themeMode.mode === "midnight"} onPress={() => themeMode.setMode("midnight")}>
            Midnight
          </Chip>
        </View>
        <Text variant="labelLarge" style={styles.groupLabel}>
          Display mode
        </Text>
        <View style={styles.chipRow}>
          <Chip selected={themeMode.appearance === "light"} onPress={() => themeMode.setAppearance("light")}>
            Light
          </Chip>
          <Chip selected={themeMode.appearance === "dark"} onPress={() => themeMode.setAppearance("dark")}>
            Dark
          </Chip>
        </View>
      </View>

      <View style={styles.card}>
        <Text variant="titleMedium" style={styles.title}>
          Audio Guide
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Turn spoken prompts on or off.
        </Text>
        <View style={styles.row}>
          <Text variant="bodyLarge" style={styles.rowLabel}>
            Enabled
          </Text>
          <Switch value={child?.audio_guide_enabled ?? audio.enabled} onValueChange={(value) => void onToggleAudio(value)} />
        </View>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {showAndroidDeviceFeatures ? (
        <View style={styles.card}>
          <Text variant="titleMedium" style={styles.title}>
            App blocking (this phone)
          </Text>
          {!nativeReady || !isAppBlockingAvailable() ? (
            <Text variant="bodyMedium" style={styles.subtitle}>
              This install does not include LearnGate device controls. Rebuild and reinstall: run{" "}
              <Text style={styles.mono}>npm run android</Text> locally, or create a new EAS APK after the latest code is
              pushed to git.
            </Text>
          ) : (
            <>
              <Text variant="bodyMedium" style={styles.subtitle}>
                Your parent picks which apps to block on this phone.
              </Text>
              <Text variant="bodySmall" style={styles.sectionLabel}>
                Blocked apps right now
              </Text>
              {blockedApps.length === 0 ? (
                <Text variant="bodyMedium" style={styles.mutedSmall}>
                  None right now.
                </Text>
              ) : (
                <View style={styles.blockedList}>
                  {blockedApps.map((app) => (
                    <View key={app.key} style={[styles.blockedRow, { borderColor: c.border }]}>
                      <View style={[styles.blockedIconWrap, { backgroundColor: c.surfaceTint }]}>
                        <MaterialCommunityIcons name={app.icon} size={24} color={c.primaryDark} />
                      </View>
                      <Text variant="bodyLarge" style={[styles.blockedLabel, { color: c.text }]}>
                        {app.label}
                      </Text>
                      <MaterialCommunityIcons name="lock" size={18} color={c.warning} />
                    </View>
                  ))}
                </View>
              )}
              <StatusInfoRow
                label="LearnGate Accessibility"
                enabled={accessibilityOn}
                description="Keeps screen-time and bedtime lock working. It blocks Home, Recents, and other apps while LearnGate is locked."
                colors={c}
              />
            </>
          )}
        </View>
      ) : null}

      {showAndroidDeviceFeatures ? (
        <View style={styles.card}>
          <Text variant="titleMedium" style={styles.title}>
            App activity reporting
          </Text>
          {!nativeReady || !isUsageStatsAvailable() ? (
            <Text variant="bodyMedium" style={styles.subtitle}>
              Usage monitoring needs the same native LearnGate build as app blocking. Install a fresh APK after rebuilding
              with the steps above.
            </Text>
          ) : (
            <>
              <Text variant="bodyMedium" style={styles.subtitle}>
                Lets your parent see which apps you open on this phone in their Recent Activity list.
              </Text>
              <StatusInfoRow
                label="Usage access"
                enabled={usageAccessOn}
                description="When on, LearnGate shares app opens with your parent automatically in the background."
                colors={c}
              />
            </>
          )}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text variant="titleMedium" style={styles.title}>
          Account
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Manage child account settings.
        </Text>
        <Button mode="contained" onPress={() => setConfirmVisible(true)} style={styles.logoutButton} contentStyle={styles.logoutButtonContent}>
          Log Out
        </Button>
      </View>

      <Portal>
        <Dialog visible={confirmVisible} onDismiss={() => setConfirmVisible(false)}>
          <Dialog.Title>Log out</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">Are you sure you want to log out?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button mode="text" onPress={() => setConfirmVisible(false)}>
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={() => {
                setConfirmVisible(false);
                void (async () => {
                  await clearBlockedPackagesFromNative();
                  await signOut();
                })();
              }}
              style={styles.dialogLogout}
            >
              Log Out
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScreenContainer>
  );
}

function createStyles(c: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.card,
      borderRadius: radii.md,
      padding: 16,
      gap: 10,
      borderWidth: 1,
      borderColor: c.border,
      ...shadows.card,
    },
    title: {
      color: c.text,
      fontWeight: "700",
    },
    subtitle: {
      color: c.subtext,
    },
    mono: {
      fontFamily: "monospace",
      color: c.text,
    },
    groupLabel: {
      color: c.text,
      marginTop: 4,
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 4,
    },
    rowLabel: {
      color: c.text,
    },
    logoutButton: {
      backgroundColor: "#B91C1C",
      marginTop: 8,
    },
    logoutButtonContent: {
      minHeight: 46,
    },
    dialogLogout: {
      backgroundColor: "#B91C1C",
    },
    errorText: {
      color: "#B91C1C",
    },
    sectionLabel: {
      color: c.subtext,
      fontWeight: "600",
      marginTop: 8,
    },
    mutedSmall: {
      color: c.subtext,
      marginTop: 2,
    },
    blockedList: {
      gap: 8,
      marginTop: 4,
    },
    blockedRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
    },
    blockedIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    blockedLabel: {
      flex: 1,
      fontWeight: "600",
    },
    statusCard: {
      marginTop: 12,
      padding: 12,
      borderRadius: radii.sm,
      borderWidth: 1,
      gap: 6,
    },
    statusHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    statusTitle: {
      fontWeight: "700",
    },
    statusDescription: {
      lineHeight: 18,
    },
  });
}

const statusStyles = StyleSheet.create({
  card: {
    marginTop: 12,
    padding: 12,
    borderRadius: radii.sm,
    borderWidth: 1,
    gap: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  title: {
    fontWeight: "700",
  },
  description: {
    lineHeight: 18,
  },
});
