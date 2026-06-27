import { useCallback, useMemo, useState } from "react";
import { Image, Platform, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { ActivityIndicator, Avatar, Button, Chip, Dialog, Portal, Switch, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { StarResetCountdown } from "@/components/child/StarResetCountdown";
import { PrimaryButton } from "@/components/PrimaryButton";
import { blockedAppsForDisplay } from "@/constants/blockedAppPackages";
import { useAuth } from "@/store/AuthContext";
import { radii, shadows } from "@/theme/theme";
import { useAppColors } from "@/theme/useAppColors";
import { useAudioGuidance } from "@/store/AudioGuidanceContext";
import { useThemeMode } from "@/store/ThemeModeContext";
import { useChildProfile } from "@/hooks/useChildProfile";
import { useChildAchievements } from "@/hooks/useChildAchievements";
import { supabase } from "@/services/supabase";
import { formatAppError } from "@/utils/errors";
import { pickChildAvatarFromLibrary, uploadChildAvatar } from "@/services/childAvatar";
import { clearBlockedPackagesFromNative, getAccessibilityEnabled, isAppBlockingAvailable } from "@/services/appBlocking";
import { getUsageAccessGranted, isUsageStatsAvailable } from "@/services/appUsageStats";
import { hasLearnGateNativeModules } from "@/services/learnGateNative";
import { registerAndSavePushToken, hasMyPushToken } from "@/services/pushNotifications";
import { levelToDifficultyLabel } from "@/utils/difficulty";

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

const statusStyles = StyleSheet.create({
  card: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  title: { fontWeight: "700", flex: 1 },
  description: { lineHeight: 20 },
});

export function ChildProfileSettingsScreen() {
  const { signOut } = useAuth();
  const audio = useAudioGuidance();
  const themeMode = useThemeMode();
  const c = useAppColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const { child, loading: profileLoading, refresh } = useChildProfile();
  const { stats: achievementStats } = useChildAchievements(child);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [accessibilityOn, setAccessibilityOn] = useState<boolean | null>(null);
  const [usageAccessOn, setUsageAccessOn] = useState<boolean | null>(null);
  const [notificationsOn, setNotificationsOn] = useState<boolean | null>(null);
  const [pushRegistering, setPushRegistering] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const hasToken = await hasMyPushToken();
        if (active) setNotificationsOn(hasToken);
      })();
      if (Platform.OS === "android" && isAppBlockingAvailable()) {
        void getAccessibilityEnabled().then((on) => {
          if (active) setAccessibilityOn(on);
        });
      } else {
        setAccessibilityOn(null);
      }
      if (Platform.OS === "android" && isUsageStatsAvailable()) {
        void getUsageAccessGranted().then((on) => {
          if (active) setUsageAccessOn(on);
        });
      } else {
        setUsageAccessOn(null);
      }
      return () => {
        active = false;
      };
    }, [])
  );

  const blockedApps = useMemo(() => blockedAppsForDisplay(child?.blocked_apps_json ?? []), [child?.blocked_apps_json]);
  const nativeReady = hasLearnGateNativeModules();
  const streakDays = achievementStats?.dailyStreak ?? 0;
  const tasksDone = achievementStats?.completedTasks ?? 0;

  const onToggleAudio = async (next: boolean) => {
    audio.setEnabled(next);
    if (!supabase || !child) return;
    const { error: updateError } = await supabase.from("children").update({ audio_guide_enabled: next }).eq("id", child.id);
    if (updateError) setError(formatAppError(updateError));
    else await refresh(true);
  };

  const onToggleNotifications = async (next: boolean) => {
    if (!next) {
      setNotificationsOn(false);
      return;
    }
    setPushRegistering(true);
    const result = await registerAndSavePushToken();
    setPushRegistering(false);
    if (!result.ok) {
      setError(result.message);
      setNotificationsOn(false);
      return;
    }
    setNotificationsOn(true);
  };

  const handleUploadAvatar = async () => {
    if (!child || !supabase) return;
    setError(null);
    try {
      const localUri = await pickChildAvatarFromLibrary();
      if (!localUri) return;
      setUploadingAvatar(true);
      const publicUrl = await uploadChildAvatar({ childId: child.id, localUri });
      const { error: updateError } = await supabase.from("children").update({ avatar_url: publicUrl }).eq("id", child.id);
      if (updateError) throw updateError;
      await refresh();
    } catch (err) {
      setError(formatAppError(err));
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <ScreenContainer scroll>
      <View style={styles.pad}>
        {profileLoading ? <ActivityIndicator size="small" color={c.primary} /> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={[styles.profileCard, { backgroundColor: c.card }]}>
          {child?.avatar_url ? (
            <Image source={{ uri: child.avatar_url }} style={styles.bigAvatar} />
          ) : (
            <Avatar.Icon size={100} icon="account" style={{ backgroundColor: c.surfaceTint }} color={c.primary} />
          )}
          <PrimaryButton
            label={uploadingAvatar ? "Uploading…" : "Change photo"}
            mode="text"
            onPress={() => void handleUploadAvatar()}
            disabled={uploadingAvatar || !child}
          />
          <Text variant="headlineSmall" style={styles.name}>
            {child?.name ?? "Profile"}
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Age {child?.age ?? "—"} · {child ? levelToDifficultyLabel(child.difficulty_level) : "—"}
          </Text>
          <View style={styles.statPills}>
            <View
              style={[
                styles.statPill,
                styles.starsPill,
                { backgroundColor: c.insightCardBg, borderColor: c.insightCardBorder },
              ]}
            >
              <MaterialCommunityIcons name="star" size={16} color={c.pinIcon} />
              <Text style={[styles.statPillText, { color: c.text }]}>{child?.stars ?? 0} Stars (week)</Text>
            </View>
            <View style={[styles.statPill, { backgroundColor: c.surfaceTint }]}>
              <Text style={[styles.statPillText, { color: c.text }]}>{tasksDone} Task Done</Text>
            </View>
            <View style={[styles.statPill, { backgroundColor: c.surfaceTint }]}>
              <Text style={[styles.statPillText, { color: c.text }]}>{streakDays} Day Streak</Text>
            </View>
          </View>
          <StarResetCountdown variant="card" subtextColor={c.subtext} />
        </View>

        <View style={[styles.card, { backgroundColor: c.card }]}>
          <Text variant="titleMedium" style={styles.cardTitle}>
            Appearance
          </Text>
          <Text variant="bodySmall" style={styles.cardSub}>
            Pick your app look.
          </Text>
          <View style={styles.chipRow}>
            {(["mint", "sunset", "midnight"] as const).map((mode) => (
              <Chip
                key={mode}
                selected={themeMode.mode === mode}
                onPress={() => themeMode.setMode(mode)}
                style={themeMode.mode === mode ? { backgroundColor: c.surfaceTint } : undefined}
                textStyle={{ color: c.text }}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Chip>
            ))}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: c.card }]}>
          <Text variant="titleMedium" style={styles.cardTitle}>
            App Settings
          </Text>
          <SettingRow
            label="Dark Mode"
            sub="Use a darker interface for night time."
            value={themeMode.appearance === "dark"}
            onChange={(v) => themeMode.setAppearance(v ? "dark" : "light")}
          />
          <SettingRow
            label="Audio Guide"
            sub="Turn spoken prompts on or off."
            value={child?.audio_guide_enabled ?? audio.enabled}
            onChange={(v) => void onToggleAudio(v)}
          />
          <SettingRow
            label="Notifications"
            sub="Receive reminders for tasks and rewards."
            value={notificationsOn === true}
            disabled={pushRegistering}
            onChange={(v) => void onToggleNotifications(v)}
          />
        </View>

        {Platform.OS === "android" && nativeReady ? (
          <View style={[styles.card, { backgroundColor: c.card }]}>
            <Text variant="titleMedium" style={styles.cardTitle}>
              Privacy &amp; Access
            </Text>
            <Text variant="bodySmall" style={styles.cardSub}>
              These permissions are set on this device by a parent. You can see their status here.
            </Text>
            {isAppBlockingAvailable() ? (
              <StatusInfoRow
                label="LearnGate Accessibility"
                enabled={accessibilityOn}
                description="Keeps screen-time and bedtime lock working. It blocks Home, Recents, and other apps while LearnGate is locked."
                colors={c}
              />
            ) : null}
            {isUsageStatsAvailable() ? (
              <StatusInfoRow
                label="Usage access"
                enabled={usageAccessOn}
                description="When on, LearnGate shares app opens with your parent automatically in the background."
                colors={c}
              />
            ) : null}
          </View>
        ) : null}

        {Platform.OS === "android" && nativeReady && isAppBlockingAvailable() ? (
          <View style={[styles.card, { backgroundColor: c.card }]}>
            <Text variant="titleMedium" style={styles.cardTitle}>
              Blocked apps
            </Text>
            {blockedApps.length === 0 ? (
              <Text style={styles.cardSub}>None right now.</Text>
            ) : (
              blockedApps.map((app) => (
                <View key={app.key} style={[styles.blockedRow, { borderColor: c.border }]}>
                  <MaterialCommunityIcons name={app.icon} size={22} color={c.primaryDark} />
                  <Text style={{ color: c.text, flex: 1, fontWeight: "600" }}>{app.label}</Text>
                  <MaterialCommunityIcons name="lock" size={16} color={c.warning} />
                </View>
              ))
            )}
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: c.card }]}>
          <Text variant="titleMedium" style={styles.cardTitle}>
            Account
          </Text>
          <Text variant="bodySmall" style={styles.cardSub}>
            Manage child account settings.
          </Text>
          <Button mode="contained" onPress={() => setConfirmVisible(true)} style={styles.logoutBtn}>
            Log Out
          </Button>
        </View>
      </View>

      <Portal>
        <Dialog visible={confirmVisible} onDismiss={() => setConfirmVisible(false)}>
          <Dialog.Title>Log out</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">Are you sure you want to log out?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmVisible(false)}>Cancel</Button>
            <Button
              mode="contained"
              style={styles.logoutBtn}
              onPress={() => {
                setConfirmVisible(false);
                void (async () => {
                  await clearBlockedPackagesFromNative();
                  await signOut();
                })();
              }}
            >
              Log Out
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScreenContainer>
  );
}

function SettingRow({
  label,
  sub,
  value,
  onChange,
  disabled,
}: {
  label: string;
  sub: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const c = useAppColors();
  return (
    <View style={[settingStyles.row, { borderBottomColor: c.border }]}>
      <View style={{ flex: 1 }}>
        <Text variant="bodyLarge" style={{ color: c.text, fontWeight: "600" }}>
          {label}
        </Text>
        <Text variant="bodySmall" style={{ color: c.subtext }}>
          {sub}
        </Text>
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} />
    </View>
  );
}

const settingStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
});

function createStyles(c: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    pad: { paddingBottom: 32, gap: 14 },
    profileCard: {
      borderRadius: radii.lg,
      padding: 20,
      alignItems: "center",
      gap: 8,
      ...shadows.card,
    },
    bigAvatar: { width: 100, height: 100, borderRadius: 50 },
    name: { color: c.text, fontWeight: "800", marginTop: 4 },
    subtitle: { color: c.subtext },
    statPills: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 8 },
    statPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radii.pill,
    },
    starsPill: { borderWidth: 1 },
    statPillText: { fontWeight: "600", fontSize: 13 },
    card: { borderRadius: radii.md, padding: 16, gap: 10, ...shadows.card },
    cardTitle: { color: c.text, fontWeight: "700" },
    cardSub: { color: c.subtext },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    groupLabel: { color: c.text, marginTop: 4 },
    blockedRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 8,
      borderBottomWidth: 1,
    },
    logoutBtn: { backgroundColor: "#B91C1C", marginTop: 4 },
    errorText: { color: "#B91C1C" },
  });
}
