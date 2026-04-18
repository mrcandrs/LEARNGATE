import { useCallback, useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { ActivityIndicator, Card, Divider, Snackbar, Switch, Text, TextInput } from "react-native-paper";
import { ScreenContainer } from "@/components/ScreenContainer";
import { colors } from "@/theme/theme";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/store/AuthContext";
import { PrimaryButton } from "@/components/PrimaryButton";

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
  const [rule, setRule] = useState<ScreenRule | null>(null);
  const [blockedAppsInput, setBlockedAppsInput] = useState("");
  const [taskRequirementsInput, setTaskRequirementsInput] = useState("");
  const [rewardMultiplierInput, setRewardMultiplierInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Unable to resolve parent user.");
      setIsLoading(false);
      return;
    }

    const { data: childData, error: childrenError } = await supabase
      .from("children")
      .select("id, name, daily_limit_minutes, bedtime_start, bedtime_end, difficulty_level")
      .eq("parent_id", user.id)
      .order("created_at", { ascending: true });

    if (childrenError) {
      setError(childrenError.message);
      setIsLoading(false);
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
      return;
    }

    const { data: rulesData, error: rulesError } = await supabase
      .from("screen_rules")
      .select("child_id, blocked_apps_json, unlock_after_task_count, reward_multiplier, daily_report_enabled, task_reminders_enabled")
      .eq("child_id", nextChildId)
      .maybeSingle();

    if (rulesError) {
      setError(rulesError.message);
      setIsLoading(false);
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
  }, [isSupabaseConfigured, selectedChildId]);

  useEffect(() => {
    void loadSettings();
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
      setError(upsertError.message);
      return;
    }
    setSnackbar("Parent settings saved successfully.");
    await loadSettings();
  };

  return (
    <ScreenContainer scroll>
      <Text variant="headlineMedium" style={styles.title}>
        Parent Settings
      </Text>

      {isLoading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {children.length > 0 ? (
        <Card>
          <Card.Title title="Selected Child" />
          <Card.Content style={styles.block}>
            {children.map((child) => (
              <PrimaryButton
                key={child.id}
                label={child.name}
                mode={child.id === selectedChildId ? "contained" : "outlined"}
                onPress={() => setSelectedChildId(child.id)}
              />
            ))}
          </Card.Content>
        </Card>
      ) : (
        <Text>No child profile found yet. Add a child first in Manage Children.</Text>
      )}

      <Card>
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

      <Card>
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

      <Card>
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
      <PrimaryButton label="Refresh" onPress={() => void loadSettings()} mode="text" />
      <Snackbar visible={Boolean(snackbar)} onDismiss={() => setSnackbar(null)} duration={1800}>
        {snackbar ?? ""}
      </Snackbar>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontWeight: "700",
  },
  block: {
    gap: 10,
  },
  errorText: {
    color: "#B91C1C",
  },
});
