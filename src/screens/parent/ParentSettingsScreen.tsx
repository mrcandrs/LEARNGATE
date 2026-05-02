import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ActivityIndicator, Card, Divider, Menu, Snackbar, Switch, Text, TextInput } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { colors, radii, shadows } from "@/theme/theme";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/store/AuthContext";
import { PrimaryButton } from "@/components/PrimaryButton";
import { formatAppError } from "@/utils/errors";

type ChildSummary = {
  id: string;
  name: string;
  daily_limit_minutes: number;
  bedtime_start: string;
  bedtime_end: string;
  difficulty_level: number;
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
  const { isSupabaseConfigured } = useAuth();
  const [children, setChildren] = useState<ChildSummary[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [childMenuVisible, setChildMenuVisible] = useState(false);
  const [rule, setRule] = useState<ScreenRule | null>(null);
  const [blockedAppsInput, setBlockedAppsInput] = useState("");
  const [taskRequirementsInput, setTaskRequirementsInput] = useState("");
  const [rewardMultiplierInput, setRewardMultiplierInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);

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
      .select("id, name, daily_limit_minutes, bedtime_start, bedtime_end, difficulty_level")
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
      setBlockedAppsInput("");
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
    setBlockedAppsInput(loadedRule.blocked_apps_json.join(", "));
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
      blocked_apps_json: blockedAppsInput
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    };

    const { error: upsertError } = await supabase.from("screen_rules").upsert(payload, { onConflict: "child_id" });
    if (upsertError) {
      setError(formatAppError(upsertError));
      return;
    }
    setSnackbar("Parent settings saved successfully.");
    await loadSettings(false);
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
          <TextInput
            label="Blocked Apps (comma separated)"
            mode="outlined"
            value={blockedAppsInput}
            onChangeText={setBlockedAppsInput}
            disabled={!rule}
          />
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title title="Learning Settings" />
        <Card.Content style={styles.block}>
          <Text>Default Difficulty: {selectedChild ? `Level ${selectedChild.difficulty_level}` : "N/A"}</Text>
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
        </Card.Content>
      </Card>

      <PrimaryButton label="Save Settings" onPress={() => void saveRules()} disabled={!rule} />
      <Snackbar visible={Boolean(snackbar)} onDismiss={() => setSnackbar(null)} duration={1800}>
        {snackbar ?? ""}
      </Snackbar>
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
});
