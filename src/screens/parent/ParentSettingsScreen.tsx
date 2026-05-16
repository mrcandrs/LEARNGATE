import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Card, Chip, Dialog, Divider, Menu, Portal, Snackbar, Switch, Text, TextInput, useTheme,
} from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { colors, radii, shadows } from "@/theme/theme";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/store/AuthContext";
import { PrimaryButton } from "@/components/PrimaryButton";
import { formatAppError } from "@/utils/errors";
import { levelToDifficultyLabel } from "@/utils/difficulty";
import { useThemeMode } from "@/store/ThemeModeContext";
import { registerAndSavePushToken } from "@/services/pushNotifications";
import { BLOCKABLE_APP_GROUPS, isGroupFullySelected, toggleBlockedGroup as applyBlockedGroupToggle, type BlockableAppGroup } from "@/constants/blockedAppPackages";

type ChildSummary = {
  id: string;
  name: string;
  daily_limit_minutes: number;
  bedtime_start: string;
  bedtime_end: string;
  difficulty_level: number;
  audio_guide_rate: number;
};

type ScreenRule = {
  child_id: string;
  blocked_apps_json: string[];
  unlock_after_task_count: number;
  reward_multiplier: number;
  daily_report_enabled: boolean;
  task_reminders_enabled: boolean;
};

export function ParentSettingsScreen() {
  const { isSupabaseConfigured, signOut } = useAuth();
  const themeMode = useThemeMode();
  const theme = useTheme();
  const [children, setChildren] = useState<ChildSummary[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [childMenuVisible, setChildMenuVisible] = useState(false);
  const [rule, setRule] = useState<ScreenRule | null>(null);
  const [taskRequirementsInput, setTaskRequirementsInput] = useState("");
  const [rewardMultiplierInput, setRewardMultiplierInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [pushRegistering, setPushRegistering] = useState(false);

  const loadSettings = useCallback(async (fromPull = false) => {
    if (!isSupabaseConfigured || !supabase) {
      setIsLoading(false);
      setRefreshing(false);
      return;
    }

    if (fromPull) {
      setRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError(formatAppError(userError ?? new Error("Not signed in.")));
      setIsLoading(false);
      setRefreshing(false);
      return;
    }

    const { data: childData, error: childrenError } = await supabase
      .from("children")
      .select("id, name, daily_limit_minutes, bedtime_start, bedtime_end, difficulty_level, audio_guide_rate")
      .eq("parent_id", user.id)
      .order("created_at", { ascending: true });

    if (childrenError) {
      setError(formatAppError(childrenError));
      setIsLoading(false);
      setRefreshing(false);
      return;
    }

    const list = (childData as ChildSummary[]) ?? [];
    setChildren(list);

    const nextChildId = selectedChildId && list.some((item) => item.id === selectedChildId) ? selectedChildId : list[0]?.id ?? null;
    setSelectedChildId(nextChildId);

    if (!nextChildId) {
      setRule(null);
      setTaskRequirementsInput("");
      setRewardMultiplierInput("");
      setIsLoading(false);
      setRefreshing(false);
      return;
    }

    const { data: rulesData, error: rulesError } = await supabase
      .from("screen_rules")
      .select("child_id, blocked_apps_json, unlock_after_task_count, reward_multiplier, daily_report_enabled, task_reminders_enabled")
      .eq("child_id", nextChildId)
      .maybeSingle();

    if (rulesError) {
      setError(formatAppError(rulesError));
      setIsLoading(false);
      setRefreshing(false);
      return;
    }

    const fallbackRule: ScreenRule = {
      child_id: nextChildId,
      blocked_apps_json: [],
      unlock_after_task_count: 3,
      reward_multiplier: 1,
      daily_report_enabled: true,
      task_reminders_enabled: true,
    };

    const loadedRule = (rulesData as ScreenRule | null) ?? fallbackRule;
    setRule(loadedRule);
    setTaskRequirementsInput(String(loadedRule.unlock_after_task_count));
    setRewardMultiplierInput(String(loadedRule.reward_multiplier));
    setIsLoading(false);
    setRefreshing(false);
  }, [isSupabaseConfigured, selectedChildId]);

  useEffect(() => {
    void loadSettings(false);
  }, [loadSettings]);

  const onRefresh = useCallback(() => {
    void loadSettings(true);
  }, [loadSettings]);

  const selectedChild = children.find((child) => child.id === selectedChildId);
  const selectedRate = selectedChild?.audio_guide_rate ?? 0.92;

  const updateAudioRate = async (rate: number) => {
    if (!supabase || !selectedChildId) return;
    const { error: updateError } = await supabase.from("children").update({ audio_guide_rate: rate }).eq("id", selectedChildId);
    if (updateError) {
      setError(formatAppError(updateError));
      return;
    }
    setChildren((prev) => prev.map((child) => (child.id === selectedChildId ? { ...child, audio_guide_rate: rate } : child)));
    setSnackbar("Audio guide pace saved.");
  };

  const saveRules = async () => {
    if (!supabase || !rule || !selectedChildId) {
      return;
    }
    setError(null);

    if (!taskRequirementsInput.trim() || !rewardMultiplierInput.trim()) {
      setError("Task requirements and reward multiplier are required.");
      return;
    }

    const taskCount = Number(taskRequirementsInput);
    const multiplier = Number(rewardMultiplierInput);
    if (Number.isNaN(taskCount) || Number.isNaN(multiplier)) {
      setError("Please enter valid numeric values.");
      return;
    }

    const payload: ScreenRule = {
      ...rule,
      child_id: selectedChildId,
      unlock_after_task_count: taskCount,
      reward_multiplier: multiplier,
      blocked_apps_json: rule.blocked_apps_json,
    };

    const { error: upsertError } = await supabase.from("screen_rules").upsert(payload, { onConflict: "child_id" });
    if (upsertError) {
      setError(formatAppError(upsertError));
      return;
    }
    setSnackbar("Parent settings saved successfully.");
    await loadSettings(false);
  };

  const toggleBlockedGroup = (group: BlockableAppGroup) => {
    setRule((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        blocked_apps_json: applyBlockedGroupToggle(prev.blocked_apps_json, group),
      };
    });
  };

  return (
    <ScreenContainer scroll onRefresh={onRefresh} refreshing={refreshing}>
      <Text variant="titleMedium" style={styles.kicker}>
        Screen time rules, learning defaults, and notifications per child.
      </Text>

      {isLoading && !refreshing ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {children.length > 0 ? (
        <Card style={styles.card}>
          <Card.Title title="Selected Child" />
          <Card.Content style={styles.block}>
            <Menu
              visible={childMenuVisible}
              onDismiss={() => setChildMenuVisible(false)}
              anchor={
                <Pressable
                  onPress={() => setChildMenuVisible(true)}
                  style={styles.pickerRow}
                  accessibilityRole="button"
                  accessibilityLabel="Select child"
                >
                  <View style={styles.pickerLeft}>
                    <MaterialCommunityIcons name="account-child-outline" size={20} color={colors.primaryDark} />
                    <View style={styles.pickerTextWrap}>
                      <Text variant="labelMedium" style={styles.pickerLabel}>
                        Child
                      </Text>
                      <Text variant="titleSmall" style={styles.pickerValue}>
                        {selectedChild ? selectedChild.name : "Select child"}
                      </Text>
                    </View>
                  </View>
                  <MaterialCommunityIcons name="chevron-down" size={22} color={colors.subtext} />
                </Pressable>
              }
            >
              {children.map((child) => (
                <Menu.Item
                  key={child.id}
                  title={child.name}
                  onPress={() => {
                    setSelectedChildId(child.id);
                    setChildMenuVisible(false);
                  }}
                />
              ))}
            </Menu>
          </Card.Content>
        </Card>
      ) : (
        <Text>No child profile found yet. Add a child first in Manage Children.</Text>
      )}

      <Card style={styles.card}>
        <Card.Title title="Screen Time Controls" />
        <Card.Content style={styles.block}>
          <Text>Daily Time Limit: {selectedChild ? `${selectedChild.daily_limit_minutes} minutes` : "N/A"}</Text>
          <Divider />
          <Text>
            Bedtime Schedule: {selectedChild ? `${selectedChild.bedtime_start} - ${selectedChild.bedtime_end}` : "N/A"}
          </Text>
          <Divider />
          <Text>Blocked Apps</Text>
          <Text variant="bodySmall" style={[styles.blockedHint, { color: theme.colors.onSurfaceVariant }]}>
            One tap blocks every common install variant (e.g. TikTok and TikTok Lite). Save after changing, then have the child reopen the app once so the phone gets the new list.
          </Text>
          <View style={styles.appGrid}>
            {BLOCKABLE_APP_GROUPS.map((app) => {
              const selected = rule ? isGroupFullySelected(rule.blocked_apps_json, app) : false;
              return (
                <Pressable
                  key={app.slug}
                  accessibilityRole="button"
                  accessibilityLabel={`Toggle ${app.label}`}
                  style={[
                    styles.appTile,
                    {
                      backgroundColor: selected ? theme.colors.primary : theme.colors.surfaceVariant,
                      borderColor: selected ? theme.colors.primary : theme.colors.outline,
                    },
                  ]}
                  onPress={() => toggleBlockedGroup(app)}
                  disabled={!rule}
                >
                  <MaterialCommunityIcons
                    name={app.icon}
                    size={22}
                    color={selected ? theme.colors.onPrimary : theme.colors.primary}
                  />
                  <Text
                    variant="bodySmall"
                    style={[styles.appTileLabel, { color: selected ? theme.colors.onPrimary : theme.colors.onSurface }]}
                  >
                    {app.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title title="Learning Settings" />
        <Card.Content style={styles.block}>
          <Text>Default Difficulty: {selectedChild ? levelToDifficultyLabel(selectedChild.difficulty_level) : "N/A"}</Text>
          <Divider />
          <TextInput
            label="Task Requirements"
            mode="outlined"
            keyboardType="number-pad"
            value={taskRequirementsInput}
            disabled={!rule}
            onChangeText={(value) => setTaskRequirementsInput(value.replace(/[^0-9]/g, ""))}
          />
          <Divider />
          <TextInput
            label="Reward Multiplier"
            mode="outlined"
            keyboardType="decimal-pad"
            value={rewardMultiplierInput}
            disabled={!rule}
            onChangeText={(value) => setRewardMultiplierInput(value.replace(/[^0-9.]/g, ""))}
          />
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title title="Notifications" />
        <Card.Content style={styles.block}>
          <Text>Daily Report</Text>
          <Switch
            value={Boolean(rule?.daily_report_enabled)}
            disabled={!rule}
            onValueChange={(value) => setRule((prev) => (prev ? { ...prev, daily_report_enabled: value } : prev))}
          />
          <Divider />
          <Text>Task Reminders</Text>
          <Switch
            value={Boolean(rule?.task_reminders_enabled)}
            disabled={!rule}
            onValueChange={(value) => setRule((prev) => (prev ? { ...prev, task_reminders_enabled: value } : prev))}
          />
          <Divider />
          <Text variant="bodySmall" style={styles.pushHint}>
            Device alerts (new tasks, submissions) need notification permission and a development build — not Expo Go.
          </Text>
          <Button
            mode="outlined"
            loading={pushRegistering}
            disabled={pushRegistering}
            onPress={async () => {
              setPushRegistering(true);
              try {
                const result = await registerAndSavePushToken();
                setSnackbar(result.message);
                if (!result.ok && __DEV__) {
                  console.warn("[push] registration:", result.message);
                }
              } finally {
                setPushRegistering(false);
              }
            }}
          >
            Enable push on this device
          </Button>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title title="Appearance" />
        <Card.Content style={styles.block}>
          <Text>App Theme</Text>
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
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title title="Audio Guide" />
        <Card.Content style={styles.block}>
          <Text>Speech Pace</Text>
          <View style={styles.chipRow}>
            <Chip selected={selectedRate <= 0.86} onPress={() => void updateAudioRate(0.84)}>
              Slow
            </Chip>
            <Chip selected={selectedRate > 0.86 && selectedRate < 0.98} onPress={() => void updateAudioRate(0.92)}>
              Normal
            </Chip>
            <Chip selected={selectedRate >= 0.98} onPress={() => void updateAudioRate(1.05)}>
              Fast
            </Chip>
          </View>
        </Card.Content>
      </Card>

      <PrimaryButton label="Save Settings" onPress={() => void saveRules()} disabled={!rule} />
      <Button mode="contained" onPress={() => setConfirmVisible(true)} style={styles.logoutButton}>
        Log Out
      </Button>
      <Snackbar visible={Boolean(snackbar)} onDismiss={() => setSnackbar(null)} duration={5000}>
        {snackbar ?? ""}
      </Snackbar>
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
                void signOut();
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

const styles = StyleSheet.create({
  kicker: {
    color: colors.subtext,
    marginBottom: 4,
  },
  card: {
    borderRadius: radii.md,
    ...shadows.card,
  },
  block: {
    gap: 10,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  blockedHint: {
    marginTop: 4,
  },
  pushHint: {
    color: colors.subtext,
    marginTop: 4,
  },
  appGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  appTile: {
    width: "31%",
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  appTileLabel: {
    fontWeight: "600",
    textAlign: "center",
  },
  pickerRow: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  pickerTextWrap: {
    flex: 1,
  },
  pickerLabel: {
    color: colors.subtext,
  },
  pickerValue: {
    color: colors.text,
    fontWeight: "700",
  },
  errorText: {
    color: "#B91C1C",
  },
  logoutButton: {
    backgroundColor: "#B91C1C",
  },
  dialogLogout: {
    backgroundColor: "#B91C1C",
  },
});
