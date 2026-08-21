import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Card, Chip, Dialog, Divider, Menu, Portal, Switch, Text, TextInput } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { radii, shadows, type AppColors } from "@/theme/theme";
import { useAppColors } from "@/theme/useAppColors";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/store/AuthContext";
import { PrimaryButton } from "@/components/PrimaryButton";
import { DestructiveButton } from "@/components/DestructiveButton";
import { formatAppError } from "@/utils/errors";
import { useThemeMode } from "@/store/ThemeModeContext";
import { registerAndSavePushToken } from "@/services/pushNotifications";
import { LegalSectionCard } from "@/components/legal/LegalSectionCard";
import { useLocale } from "@/store/LocaleContext";
import { useAppToast } from "@/store/AppToastContext";
import { LanguagePicker } from "@/components/LanguagePicker";
import { useParentSelectedChild } from "@/store/ParentSelectedChildContext";
import {
  deleteParentAccount,
  PARENT_ACCOUNT_DELETE_CONFIRMATION,
} from "@/services/parentAccountDelete";

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
  const { t } = useLocale();
  const { showToast } = useAppToast();
  const { selectedChildId, selectChild, clearSelectedChild, syncWithAvailableChildren } = useParentSelectedChild();
  const themeMode = useThemeMode();
  const c = useAppColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const [children, setChildren] = useState<ChildSummary[]>([]);
  const [childMenuVisible, setChildMenuVisible] = useState(false);
  const [rule, setRule] = useState<ScreenRule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [pushRegistering, setPushRegistering] = useState(false);

  const deleteConfirmationMatches =
    deleteConfirmText.trim() === PARENT_ACCOUNT_DELETE_CONFIRMATION;

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
    syncWithAvailableChildren(list.map((item) => item.id));
    setIsLoading(false);
    setRefreshing(false);
  }, [isSupabaseConfigured, syncWithAvailableChildren]);

  const loadRulesForChild = useCallback(async (childId: string) => {
    if (!supabase) {
      setRule(null);
      return;
    }

    const { data: rulesData, error: rulesError } = await supabase
      .from("screen_rules")
      .select("child_id, blocked_apps_json, unlock_after_task_count, reward_multiplier, daily_report_enabled, task_reminders_enabled")
      .eq("child_id", childId)
      .maybeSingle();

    if (rulesError) {
      setError(formatAppError(rulesError));
      setRule(null);
      return;
    }

    const fallbackRule: ScreenRule = {
      child_id: childId,
      blocked_apps_json: [],
      unlock_after_task_count: 3,
      reward_multiplier: 1,
      daily_report_enabled: true,
      task_reminders_enabled: true,
    };

    setRule((rulesData as ScreenRule | null) ?? fallbackRule);
  }, []);

  useEffect(() => {
    void loadSettings(false);
  }, [loadSettings]);

  useEffect(() => {
    if (!selectedChildId) {
      setRule(null);
      return;
    }
    void loadRulesForChild(selectedChildId);
  }, [selectedChildId, loadRulesForChild]);

  const onRefresh = useCallback(() => {
    void loadSettings(true);
  }, [loadSettings]);

  const selectedChild = children.find((child) => child.id === selectedChildId);

  const saveRules = async () => {
    if (!supabase || !rule || !selectedChildId) {
      return;
    }
    setError(null);

    const payload: ScreenRule = {
      ...rule,
      child_id: selectedChildId,
    };

    const { error: upsertError } = await supabase.from("screen_rules").upsert(payload, { onConflict: "child_id" });
    if (upsertError) {
      setError(formatAppError(upsertError));
      return;
    }
    showToast(t("parent.settings.settingsSaved"));
    await loadSettings(false);
  };

  const openDeleteAccountDialog = () => {
    setDeleteConfirmText("");
    setDeleteConfirmVisible(true);
  };

  const closeDeleteAccountDialog = () => {
    if (deleteBusy) {
      return;
    }
    setDeleteConfirmVisible(false);
    setDeleteConfirmText("");
  };

  const confirmDeleteAccount = async () => {
    if (!deleteConfirmationMatches || deleteBusy) {
      return;
    }
    setDeleteBusy(true);
    setError(null);
    const result = await deleteParentAccount(deleteConfirmText);
    if (!result.ok) {
      setDeleteBusy(false);
      setError(formatAppError(new Error(result.message)));
      return;
    }
    clearSelectedChild();
    showToast(t("parent.settings.accountDeleted"));
    setDeleteBusy(false);
    setDeleteConfirmVisible(false);
    setDeleteConfirmText("");
    await signOut();
  };

  return (
    <ScreenContainer scroll onRefresh={onRefresh} refreshing={refreshing}>
      <Text variant="titleMedium" style={styles.kicker}>
        {t("parent.settings.kicker")}
      </Text>

      {isLoading && !refreshing ? <ActivityIndicator size="small" color={c.primary} /> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {children.length > 0 ? (
        <Card style={styles.card}>
          <Card.Title title={t("parent.settings.selectedChild")} />
          <Card.Content style={styles.block}>
            <Menu
              visible={childMenuVisible}
              onDismiss={() => setChildMenuVisible(false)}
              anchor={
                <Pressable
                  onPress={() => setChildMenuVisible(true)}
                  style={styles.pickerRow}
                  accessibilityRole="button"
                  accessibilityLabel={t("parent.settings.selectChild")}
                >
                  <View style={styles.pickerLeft}>
                    <MaterialCommunityIcons name="account-child-outline" size={20} color={c.primaryDark} />
                    <View style={styles.pickerTextWrap}>
                      <Text variant="labelMedium" style={styles.pickerLabel}>
                        {t("parent.settings.child")}
                      </Text>
                      <Text variant="titleSmall" style={styles.pickerValue}>
                        {selectedChild ? selectedChild.name : t("parent.settings.selectChild")}
                      </Text>
                    </View>
                  </View>
                  <MaterialCommunityIcons name="chevron-down" size={22} color={c.subtext} />
                </Pressable>
              }
            >
              {children.map((child) => (
                <Menu.Item
                  key={child.id}
                  title={child.name}
                  onPress={() => {
                    selectChild(child.id);
                    setChildMenuVisible(false);
                  }}
                />
              ))}
            </Menu>
          </Card.Content>
        </Card>
      ) : (
        <Text>{t("parent.settings.noChildProfile")}</Text>
      )}

      <Card style={styles.card}>
        <Card.Title title={t("parent.settings.notifications")} />
        <Card.Content style={styles.block}>
          <Text>{t("parent.settings.dailyReport")}</Text>
          <Switch
            value={Boolean(rule?.daily_report_enabled)}
            disabled={!rule}
            onValueChange={(value) => setRule((prev) => (prev ? { ...prev, daily_report_enabled: value } : prev))}
          />
          <Divider />
          <Text>{t("parent.settings.taskReminders")}</Text>
          <Switch
            value={Boolean(rule?.task_reminders_enabled)}
            disabled={!rule}
            onValueChange={(value) => setRule((prev) => (prev ? { ...prev, task_reminders_enabled: value } : prev))}
          />
          <Divider />
          <Text variant="bodySmall" style={styles.pushHint}>
            {t("parent.settings.pushHint")}
          </Text>
          <Button
            mode="outlined"
            loading={pushRegistering}
            disabled={pushRegistering}
            onPress={async () => {
              setPushRegistering(true);
              try {
                const result = await registerAndSavePushToken();
                showToast(result.message, result.ok ? "success" : "error");
                if (!result.ok && __DEV__) {
                  console.warn("[push] registration:", result.message);
                }
              } finally {
                setPushRegistering(false);
              }
            }}
          >
            {t("parent.settings.enablePush")}
          </Button>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title title={t("parent.settings.appearance")} />
        <Card.Content style={styles.block}>
          <Text variant="labelLarge">{t("parent.settings.themeMode")}</Text>
          <View style={styles.chipRow}>
            <Chip selected={themeMode.mode === "mint"} onPress={() => themeMode.setMode("mint")}>
              {t("parent.settings.mint")}
            </Chip>
            <Chip selected={themeMode.mode === "sunset"} onPress={() => themeMode.setMode("sunset")}>
              {t("parent.settings.sunset")}
            </Chip>
            <Chip selected={themeMode.mode === "midnight"} onPress={() => themeMode.setMode("midnight")}>
              {t("parent.settings.midnight")}
            </Chip>
          </View>
          <Text variant="labelLarge" style={styles.appearanceLabel}>
            {t("parent.settings.displayMode")}
          </Text>
          <View style={styles.chipRow}>
            <Chip selected={themeMode.appearance === "light"} onPress={() => themeMode.setAppearance("light")}>
              {t("parent.settings.light")}
            </Chip>
            <Chip selected={themeMode.appearance === "dark"} onPress={() => themeMode.setAppearance("dark")}>
              {t("parent.settings.dark")}
            </Chip>
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title title={t("parent.settings.language")} />
        <Card.Content style={styles.block}>
          <Text variant="bodySmall" style={styles.pushHint}>{t("parent.settings.languageSub")}</Text>
          <LanguagePicker />
        </Card.Content>
      </Card>

      <LegalSectionCard />

      <PrimaryButton label={t("parent.settings.saveSettings")} onPress={() => void saveRules()} disabled={!rule} />

      <Card style={[styles.card, styles.dangerZoneCard]}>
        <Card.Title title={t("parent.settings.dangerZone")} titleStyle={styles.dangerZoneTitle} />
        <Card.Content style={styles.block}>
          <Text variant="bodySmall" style={styles.dangerZoneHint}>
            {t("parent.settings.dangerZoneHint")}
          </Text>
          <DestructiveButton
            label={t("parent.settings.deleteAccount")}
            icon="delete-outline"
            tone="critical"
            onPress={openDeleteAccountDialog}
          />
        </Card.Content>
      </Card>

      <DestructiveButton
        label={t("common.logOut")}
        mode="outlined"
        onPress={() => setConfirmVisible(true)}
        style={styles.logoutButton}
      />
      <Portal>
        <Dialog visible={confirmVisible} onDismiss={() => setConfirmVisible(false)} style={{ backgroundColor: c.card }}>
          <Dialog.Title style={{ color: c.text }}>{t("common.logOut")}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ color: c.text }}>{t("common.logOutConfirm")}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button mode="text" onPress={() => setConfirmVisible(false)} textColor={c.text}>
              {t("common.cancel")}
            </Button>
            <DestructiveButton
              label={t("common.logOut")}
              style={styles.dialogLogout}
              onPress={() => {
                setConfirmVisible(false);
                void signOut();
              }}
            />
          </Dialog.Actions>
        </Dialog>
        <Dialog
          visible={deleteConfirmVisible}
          onDismiss={closeDeleteAccountDialog}
          style={{ backgroundColor: c.card }}
        >
          <Dialog.Title style={{ color: c.danger }}>{t("parent.settings.deleteAccountTitle")}</Dialog.Title>
          <Dialog.Content style={styles.deleteDialogContent}>
            <Text variant="bodyMedium" style={{ color: c.text }}>
              {t("parent.settings.deleteAccountBody")}
            </Text>
            <Text variant="labelLarge" style={{ color: c.text }}>
              {t("parent.settings.deleteAccountConfirmLabel", { word: PARENT_ACCOUNT_DELETE_CONFIRMATION })}
            </Text>
            <TextInput
              mode="outlined"
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder={t("parent.settings.deleteAccountConfirmPlaceholder")}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!deleteBusy}
              outlineColor={deleteConfirmationMatches ? c.primary : c.border}
              activeOutlineColor={deleteConfirmationMatches ? c.primary : c.danger}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button mode="text" onPress={closeDeleteAccountDialog} textColor={c.text} disabled={deleteBusy}>
              {t("common.cancel")}
            </Button>
            <DestructiveButton
              label={deleteBusy ? t("parent.settings.deletingAccount") : t("parent.settings.deleteAccount")}
              icon="delete-outline"
              tone="critical"
              style={styles.dialogLogout}
              loading={deleteBusy}
              disabled={!deleteConfirmationMatches || deleteBusy}
              onPress={() => void confirmDeleteAccount()}
            />
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScreenContainer>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
  kicker: {
    color: c.subtext,
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
  appearanceLabel: {
    marginTop: 8,
  },
  autoHint: {
    color: c.subtext,
    lineHeight: 18,
  },
  blockedHint: {
    marginTop: 4,
  },
  pushHint: {
    color: c.subtext,
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
    borderColor: c.border,
    backgroundColor: c.card,
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
    color: c.subtext,
  },
  pickerValue: {
    color: c.text,
    fontWeight: "700",
  },
  errorText: {
    color: c.danger,
  },
  logoutButton: {
    marginTop: 4,
  },
  dangerZoneCard: {
    borderWidth: 1,
    borderColor: c.danger,
  },
  dangerZoneTitle: {
    color: c.danger,
  },
  dangerZoneHint: {
    color: c.subtext,
    lineHeight: 20,
  },
  deleteDialogContent: {
    gap: 12,
  },
  dialogLogout: {
    marginTop: 0,
  },
  });
}
