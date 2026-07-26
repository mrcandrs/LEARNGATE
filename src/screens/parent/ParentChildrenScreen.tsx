import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { createClient } from "@supabase/supabase-js";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Card, Chip, Dialog, Divider, IconButton, List, Portal, Switch, Text, TextInput, useTheme } from "react-native-paper";
import { ScreenContainer } from "@/components/ScreenContainer";
import { PrimaryButton } from "@/components/PrimaryButton";
import { StepperControl } from "@/components/parent/StepperControl";
import { DurationPickerModal } from "@/components/parent/DurationPickerModal";
import { BedtimePickerModal } from "@/components/parent/BedtimePickerModal";
import { BirthdayPickerModal } from "@/components/parent/BirthdayPickerModal";
import { ParentSectionHeader } from "@/components/parent/ParentSectionHeader";
import { ParentManageToast } from "@/components/parent/ParentManageToast";
import { ParentChildLocationPreview } from "@/components/parent/ParentChildLocationPreview";
import { getEvidenceSignedUrl } from "@/services/taskEvidence";
import { useAppColors } from "@/theme/useAppColors";
import type { AppColors } from "@/theme/theme";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/store/AuthContext";
import { formatAppError } from "@/utils/errors";
import { radii, shadows } from "@/theme/theme";
import { env } from "@/config/env";
import { EXERCISES, type ExerciseId } from "@/data/exercises";
import { getGamesForChildAge, isGameAllowedForChildAge, type GameId } from "@/data/childGames";
import { getAgeBandForChild } from "@/data/childAgeBands";
import {
  childBirthdayFieldHelper,
  defaultBirthdayForNewChild,
  formatBirthdayDisplay,
  formatChildAgeLine,
  getChildAge,
  validateBirthdayIso,
} from "@/utils/childBirthday";
import { difficultyTierLabel, difficultyTierToLevel, levelToDifficultyTier, type DifficultyTier } from "@/utils/difficulty";
import { learningTaskXpReward } from "@/data/gameDifficulty";
import type { ParentTabParamList } from "@/types/navigation";
import {
  BLOCKABLE_APP_GROUPS,
  blockedAppsForDisplay,
  displayAppUsageLabel,
  iconForPackage,
  isCuratedPackage,
  isGroupFullySelected,
  isPackageBlocked,
  labelForPackage,
  toggleBlockedGroup as applyBlockedGroupToggle,
  toggleBlockedPackage as applyBlockedPackageToggle,
  type BlockableAppGroup,
} from "@/constants/blockedAppPackages";
import { isReportableUserApp } from "@/utils/appUsagePackages";
import {
  DAILY_LIMIT_MAX_MINUTES,
  DAILY_LIMIT_MIN_MINUTES,
  formatBedtimeForInput,
  formatDailyLimitDbError,
  parseDailyLimitMinutes,
  validateBedtimeForDb,
} from "@/utils/childLimits";
import {
  formatBedtime12h,
  formatDailyLimitDisplay,
  parseDailyLimitValue,
  stepBedtime,
  stepDailyLimit,
} from "@/utils/screenControlSteppers";
import type { UnlockPricingEntry, UnlockPricingJson } from "@/constants/appUnlock";
import { pricingModeLabel } from "@/utils/appUnlockPackages";

type ManageToast = { message: string; variant: "success" | "error" };

type ChildRow = {
  id: string;
  child_user_id: string | null;
  login_email: string | null;
  login_secret: string | null;
  auth_pin: string;
  name: string;
  birthday: string | null;
  age: number;
  stars: number;
  daily_limit_minutes: number;
  difficulty_level: number;
  bedtime_start: string;
  bedtime_end: string;
  screen_limit_enabled: boolean;
  bedtime_enabled: boolean;
  audio_guide_rate: number;
  avatar_url: string | null;
  is_online: boolean;
  last_seen_at: string | null;
};

type ScreenRule = {
  child_id: string;
  blocked_apps_json: string[];
  unlock_after_task_count: number;
  reward_multiplier: number;
  daily_report_enabled: boolean;
  task_reminders_enabled: boolean;
  app_unlock_enabled: boolean;
  unlock_pricing_json: UnlockPricingJson;
};

type UsedAppRow = {
  package_name: string;
  app_label: string | null;
};

type SubmissionPreviewRow = {
  id: string;
  created_at: string;
  image_url: string | null;
  task_id: string;
  child_id: string;
  tasks: { title: string; xp_reward: number } | null;
};

function normalizeJoined<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function formatDailyLimitSummary(minutes: number): string {
  if (minutes >= 60 && minutes % 60 === 0) {
    return `${minutes / 60} hr`;
  }
  if (minutes >= 60) {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hrs} hr ${mins} min` : `${hrs} hr`;
  }
  return `${minutes} min`;
}

function audioRateLabel(rate: number): string {
  if (rate <= 0.86) {
    return "Slow";
  }
  if (rate >= 0.98) {
    return "Fast";
  }
  return "Medium";
}

type ChildDraft = {
  daily_limit_minutes: string;
  difficulty_level: DifficultyTier;
  bedtime_start: string;
  bedtime_end: string;
  screen_limit_enabled: boolean;
  bedtime_enabled: boolean;
};

export function ParentChildrenScreen() {
  const { isSupabaseConfigured } = useAuth();
  const route = useRoute<RouteProp<ParentTabParamList, "Children">>();
  const navigation = useNavigation<BottomTabNavigationProp<ParentTabParamList>>();
  const theme = useTheme();
  const c = useAppColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ChildDraft>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [pinBusyChildId, setPinBusyChildId] = useState<string | null>(null);
  const [saveBusyChildId, setSaveBusyChildId] = useState<string | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [childPickerVisible, setChildPickerVisible] = useState(false);
  const [toast, setToast] = useState<ManageToast | null>(null);
  const [durationPickerOpen, setDurationPickerOpen] = useState(false);
  const [bedtimePickerField, setBedtimePickerField] = useState<"start" | "end" | null>(null);
  const [childToDelete, setChildToDelete] = useState<ChildRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [clearUsageConfirm, setClearUsageConfirm] = useState(false);
  const [clearingUsage, setClearingUsage] = useState(false);
  const [submissionsHighlight, setSubmissionsHighlight] = useState(false);

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      const key = route.params?.navKey;
      if (!key) {
        return;
      }
      if (route.params?.childId) {
        setSelectedChildId(route.params.childId);
      }
      let highlightTimer: ReturnType<typeof setTimeout> | undefined;
      if (route.params?.focusSubmissions) {
        setSubmissionsHighlight(true);
        highlightTimer = setTimeout(() => setSubmissionsHighlight(false), 3200);
      }
      navigation.setParams({
        childId: undefined,
        focusSubmissions: undefined,
        navKey: undefined,
      });
      return () => {
        if (highlightTimer) {
          clearTimeout(highlightTimer);
        }
      };
    }, [navigation, route.params?.childId, route.params?.focusSubmissions, route.params?.navKey])
  );

  const showError = useCallback((message: string) => {
    setToast({ message, variant: "error" });
  }, []);

  const showSuccess = useCallback((message: string) => {
    setToast({ message, variant: "success" });
  }, []);
  const [newChildName, setNewChildName] = useState("");
  const [newChildBirthday, setNewChildBirthday] = useState(() => defaultBirthdayForNewChild());
  const [birthdayPickerMode, setBirthdayPickerMode] = useState<"create" | "edit" | null>(null);
  const [birthdaySaving, setBirthdaySaving] = useState(false);
  const [newChildEmail, setNewChildEmail] = useState("");
  const [exerciseTarget, setExerciseTarget] = useState<ChildRow | null>(null);
  const [exerciseId, setExerciseId] = useState<ExerciseId>("jumping_jacks");
  const [exerciseReps, setExerciseReps] = useState("10");
  const [exercisePoints, setExercisePoints] = useState("20");
  const [assigning, setAssigning] = useState(false);
  const [learningTarget, setLearningTarget] = useState<ChildRow | null>(null);
  const [learningGameId, setLearningGameId] = useState<GameId>("alphabet");
  const [learningDifficulty, setLearningDifficulty] = useState<DifficultyTier>("medium");
  const [choreTarget, setChoreTarget] = useState<ChildRow | null>(null);
  const [choreTitle, setChoreTitle] = useState("");
  const [chorePoints, setChorePoints] = useState("30");
  const [assigningLearning, setAssigningLearning] = useState(false);
  const [assigningChore, setAssigningChore] = useState(false);
  const [screenRule, setScreenRule] = useState<ScreenRule | null>(null);
  const [usedApps, setUsedApps] = useState<UsedAppRow[]>([]);
  const [submissionRows, setSubmissionRows] = useState<SubmissionPreviewRow[]>([]);
  const [reviewBusyId, setReviewBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<SubmissionPreviewRow | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [submissionImageUrls, setSubmissionImageUrls] = useState<Record<string, string>>({});

  const assignableLearningGames = useMemo(
    () => (learningTarget ? getGamesForChildAge(getChildAge(learningTarget)) : []),
    [learningTarget]
  );

  const learningTargetAgeBand = useMemo(
    () => (learningTarget ? getAgeBandForChild(getChildAge(learningTarget)) : null),
    [learningTarget]
  );

  useEffect(() => {
    if (!learningTarget || assignableLearningGames.length === 0) {
      return;
    }
    if (!isGameAllowedForChildAge(learningGameId, getChildAge(learningTarget))) {
      setLearningGameId(assignableLearningGames[0].id);
    }
  }, [learningTarget, assignableLearningGames, learningGameId]);

  const loadChildren = useCallback(async (fromPull = false, silent = false) => {
    if (!isSupabaseConfigured || !supabase) {
      setChildren([]);
      setDrafts({});
      setIsLoading(false);
      setRefreshing(false);
      return;
    }

    if (fromPull) {
      setRefreshing(true);
    } else if (!silent) {
      setIsLoading(true);
    }
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      showError(formatAppError(userError ?? new Error("Not signed in.")));
      setIsLoading(false);
      setRefreshing(false);
      return;
    }

    const { data, error: childrenError } = await supabase
      .from("children")
      .select(
        "id, child_user_id, login_email, login_secret, auth_pin, name, birthday, age, stars, daily_limit_minutes, screen_limit_enabled, bedtime_enabled, difficulty_level, bedtime_start, bedtime_end, audio_guide_rate, avatar_url, is_online, last_seen_at"
      )
      .eq("parent_id", user.id)
      .order("created_at", { ascending: true });

    if (childrenError) {
      showError(formatAppError(childrenError));
      setIsLoading(false);
      setRefreshing(false);
      return;
    }

    const rows = ((data ?? []) as ChildRow[]).map((row) => ({
      ...row,
      screen_limit_enabled: row.screen_limit_enabled !== false,
      bedtime_enabled: row.bedtime_enabled !== false,
    }));
    const nextDrafts = rows.reduce<Record<string, ChildDraft>>((acc, row) => {
      acc[row.id] = {
        daily_limit_minutes: String(row.daily_limit_minutes),
        difficulty_level: levelToDifficultyTier(row.difficulty_level),
        bedtime_start: formatBedtimeForInput(row.bedtime_start),
        bedtime_end: formatBedtimeForInput(row.bedtime_end),
        screen_limit_enabled: row.screen_limit_enabled !== false,
        bedtime_enabled: row.bedtime_enabled !== false,
      };
      return acc;
    }, {});
    setChildren(rows);
    setDrafts(nextDrafts);
    setSelectedChildId((prev) => (prev && rows.some((c) => c.id === prev) ? prev : rows[0]?.id ?? null));
    setIsLoading(false);
    setRefreshing(false);
  }, [isSupabaseConfigured]);

  useEffect(() => {
    void loadChildren(false);
  }, [loadChildren]);

  const loadScreenRules = useCallback(async (childId: string) => {
    if (!supabase) {
      setScreenRule(null);
      return;
    }
    const { data, error: rulesError } = await supabase
      .from("screen_rules")
      .select(
        "child_id, blocked_apps_json, unlock_after_task_count, reward_multiplier, daily_report_enabled, task_reminders_enabled, app_unlock_enabled, unlock_pricing_json"
      )
      .eq("child_id", childId)
      .maybeSingle();
    if (rulesError) {
      showError(formatAppError(rulesError));
      return;
    }
    const fallbackRule: ScreenRule = {
      child_id: childId,
      blocked_apps_json: [],
      unlock_after_task_count: 3,
      reward_multiplier: 1,
      daily_report_enabled: true,
      task_reminders_enabled: true,
      app_unlock_enabled: true,
      unlock_pricing_json: {},
    };
    const row = (data as ScreenRule | null) ?? fallbackRule;
    setScreenRule({
      ...row,
      app_unlock_enabled: row.app_unlock_enabled !== false,
      unlock_pricing_json:
        row.unlock_pricing_json && typeof row.unlock_pricing_json === "object" ? row.unlock_pricing_json : {},
    });
  }, [showError]);

  const loadUsedApps = useCallback(async (childId: string) => {
    if (!supabase) {
      setUsedApps([]);
      return;
    }
    const { data, error: usageError } = await supabase
      .from("child_app_usage_events")
      .select("package_name, app_label, event_at")
      .eq("child_id", childId)
      .eq("event_type", "foreground")
      .order("event_at", { ascending: false })
      .limit(200);
    if (usageError) {
      if (__DEV__) {
        console.warn("[LearnGate] used apps load failed:", usageError.message);
      }
      setUsedApps([]);
      return;
    }
    const seen = new Set<string>();
    const unique: UsedAppRow[] = [];
    for (const row of (data as UsedAppRow[] | null) ?? []) {
      const pkg = row.package_name?.trim();
      if (!pkg || seen.has(pkg)) continue;
      if (!isReportableUserApp(pkg)) continue;
      seen.add(pkg);
      unique.push({ package_name: pkg, app_label: row.app_label ?? null });
    }
    setUsedApps(unique);
  }, []);

  const clearUsedAppHistory = useCallback(async () => {
    if (!supabase || !selectedChildId) {
      return;
    }
    setClearingUsage(true);
    const { error: deleteError } = await supabase
      .from("child_app_usage_events")
      .delete()
      .eq("child_id", selectedChildId);
    setClearingUsage(false);
    setClearUsageConfirm(false);
    if (deleteError) {
      showError(formatAppError(deleteError));
      return;
    }
    setUsedApps([]);
    showSuccess("Recorded app history cleared. New apps will reappear as they are opened.");
  }, [selectedChildId, showError, showSuccess]);

  const loadSubmissionsPreview = useCallback(async (childId: string) => {
    if (!supabase) {
      setSubmissionRows([]);
      return;
    }
    const { data, error: qError } = await supabase
      .from("task_submissions")
      .select("id, created_at, image_url, task_id, child_id, tasks(title, xp_reward)")
      .eq("status", "submitted")
      .eq("child_id", childId)
      .order("created_at", { ascending: false });
    if (qError) {
      showError(formatAppError(qError));
      return;
    }
    const list = ((data ?? []) as Array<Omit<SubmissionPreviewRow, "tasks"> & { tasks: SubmissionPreviewRow["tasks"] | SubmissionPreviewRow["tasks"][] }>).map(
      (row) => ({
        ...row,
        tasks: normalizeJoined(row.tasks),
      })
    );
    setSubmissionRows(list);
    const urlMap: Record<string, string> = {};
    await Promise.all(
      list.map(async (row) => {
        if (!row.image_url) {
          return;
        }
        try {
          urlMap[row.id] = await getEvidenceSignedUrl(row.image_url);
        } catch {
          urlMap[row.id] = "";
        }
      })
    );
    setSubmissionImageUrls(urlMap);
  }, [showError]);

  useEffect(() => {
    if (!selectedChildId) {
      setScreenRule(null);
      setSubmissionRows([]);
      setUsedApps([]);
      return;
    }
    void loadScreenRules(selectedChildId);
    void loadSubmissionsPreview(selectedChildId);
    void loadUsedApps(selectedChildId);
  }, [selectedChildId, loadScreenRules, loadSubmissionsPreview, loadUsedApps]);

  const isEmpty = useMemo(() => !isLoading && children.length === 0, [children.length, isLoading]);

  const saveChild = async (childId: string): Promise<boolean> => {
    if (!supabase || !drafts[childId]) {
      return false;
    }
    const draft = drafts[childId];
    const { value: dailyLimit, error: limitError } = parseDailyLimitMinutes(draft.daily_limit_minutes);
    if (limitError || dailyLimit == null) {
      showError(limitError ?? "Invalid daily limit.");
      return false;
    }

    const startResult = validateBedtimeForDb(draft.bedtime_start);
    if (startResult.error || !startResult.value) {
      showError(startResult.error ?? "Invalid bedtime start.");
      return false;
    }
    const endResult = validateBedtimeForDb(draft.bedtime_end);
    if (endResult.error || !endResult.value) {
      showError(endResult.error ?? "Invalid bedtime end.");
      return false;
    }
    const bedtimeStart = startResult.value;
    const bedtimeEnd = endResult.value;

    const childPayload = {
      daily_limit_minutes: dailyLimit,
      bedtime_start: bedtimeStart,
      bedtime_end: bedtimeEnd,
      screen_limit_enabled: draft.screen_limit_enabled,
      bedtime_enabled: draft.bedtime_enabled,
    };

    let updateError = (
      await supabase
        .from("children")
        .update({ ...childPayload, screen_limit_set_at: new Date().toISOString() })
        .eq("id", childId)
    ).error;

    if (updateError?.message?.includes("screen_limit_set_at")) {
      updateError = (await supabase.from("children").update(childPayload).eq("id", childId)).error;
    }

    if (updateError) {
      const raw = updateError.message ?? "";
      showError(formatDailyLimitDbError(raw) ?? formatAppError(updateError));
      return false;
    }
    await loadChildren(false, true);
    return true;
  };

  const saveScreenRules = async (childId: string): Promise<boolean> => {
    if (!supabase || !screenRule) {
      return false;
    }
    const { error: upsertError } = await supabase.from("screen_rules").upsert(
      { ...screenRule, child_id: childId },
      { onConflict: "child_id" }
    );
    if (upsertError) {
      showError(formatAppError(upsertError));
      return false;
    }
    return true;
  };

  const saveAllForChild = async (childId: string) => {
    setSaveBusyChildId(childId);
    try {
      const childOk = await saveChild(childId);
      const rulesOk = childOk ? await saveScreenRules(childId) : false;
      if (childOk && rulesOk) {
        showSuccess("All changes saved.");
        await loadScreenRules(childId);
      } else if (childOk) {
        showSuccess("Screen limits saved. App blocking could not be saved.");
      }
    } finally {
      setSaveBusyChildId(null);
    }
  };

  const updateAudioRate = async (childId: string, rate: number) => {
    if (!supabase) {
      return;
    }
    const { error: updateError } = await supabase.from("children").update({ audio_guide_rate: rate }).eq("id", childId);
    if (updateError) {
      showError(formatAppError(updateError));
      return;
    }
    setChildren((prev) => prev.map((child) => (child.id === childId ? { ...child, audio_guide_rate: rate } : child)));
    showSuccess("Audio guide pace saved.");
  };

  const toggleBlockedGroup = (group: BlockableAppGroup) => {
    setScreenRule((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        blocked_apps_json: applyBlockedGroupToggle(prev.blocked_apps_json, group),
      };
    });
  };

  const toggleBlockedPackage = (packageName: string) => {
    setScreenRule((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        blocked_apps_json: applyBlockedPackageToggle(prev.blocked_apps_json, packageName),
      };
    });
  };

  const approveSubmission = async (row: SubmissionPreviewRow) => {
    if (!supabase) {
      return;
    }
    setReviewBusyId(row.id);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      showError(formatAppError(userError ?? new Error("Not signed in.")));
      setReviewBusyId(null);
      return;
    }
    const xp = row.tasks?.xp_reward ?? 0;
    const { error: subErr } = await supabase
      .from("task_submissions")
      .update({ status: "approved", reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      .eq("id", row.id);
    if (subErr) {
      showError(formatAppError(subErr));
      setReviewBusyId(null);
      return;
    }
    const { error: taskErr } = await supabase
      .from("tasks")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", row.task_id);
    if (taskErr) {
      showError(formatAppError(taskErr));
      setReviewBusyId(null);
      return;
    }
    const { error: awardError } = await supabase.rpc("award_child_points", {
      p_child_id: row.child_id,
      p_points: xp,
      p_event_type: "task_completed",
      p_metadata: { task_id: row.task_id, submission_id: row.id, source: "chore_approved" },
    });
    if (awardError) {
      showError(formatAppError(awardError));
      setReviewBusyId(null);
      return;
    }
    showSuccess("Submission approved.");
    setReviewBusyId(null);
    if (selectedChildId) {
      await loadSubmissionsPreview(selectedChildId);
    }
  };

  const confirmRejectSubmission = async () => {
    if (!supabase || !rejectTarget) {
      return;
    }
    setReviewBusyId(rejectTarget.id);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      showError(formatAppError(userError ?? new Error("Not signed in.")));
      setReviewBusyId(null);
      return;
    }
    const target = rejectTarget;
    const { error: subErr } = await supabase
      .from("task_submissions")
      .update({
        status: "rejected",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        notes: rejectNote.trim() || null,
      })
      .eq("id", target.id);
    if (subErr) {
      showError(formatAppError(subErr));
      setReviewBusyId(null);
      return;
    }
    const { error: taskErr } = await supabase.from("tasks").update({ status: "pending" }).eq("id", target.task_id);
    if (taskErr) {
      showError(formatAppError(taskErr));
      setReviewBusyId(null);
      return;
    }
    setRejectTarget(null);
    setRejectNote("");
    showSuccess("Submission rejected. Child can try again.");
    setReviewBusyId(null);
    if (selectedChildId) {
      await loadSubmissionsPreview(selectedChildId);
    }
  };

  const generatePin = () => String(Math.floor(100000 + Math.random() * 900000));

  const createChildAccount = async () => {
    if (!supabase) {
      return;
    }
    if (!newChildName.trim() || !newChildBirthday.trim() || !newChildEmail.trim()) {
      showError("Name, birthday, and child email are required.");
      return;
    }

    const birthdayResult = validateBirthdayIso(newChildBirthday);
    if (!birthdayResult.ok) {
      showError(birthdayResult.message);
      return;
    }
    const {
      data: { user: parentUser },
      error: parentUserError,
    } = await supabase.auth.getUser();

    if (parentUserError || !parentUser) {
      showError(formatAppError(parentUserError ?? new Error("Parent session not found.")));
      return;
    }

    setIsCreating(true);
    const pin = generatePin();
    const loginSecret = `LG-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
    if (!env.supabaseUrl || !env.supabaseAnonKey) {
      setIsCreating(false);
      showError("Supabase is not configured.");
      return;
    }

    const isolatedAuthClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const { data: signUpData, error: signUpError } = await isolatedAuthClient.auth.signUp({
      email: newChildEmail.trim().toLowerCase(),
      password: loginSecret,
      options: {
        data: {
          full_name: newChildName.trim(),
          role: "child",
        },
      },
    });

    if (signUpError || !signUpData.user?.id) {
      setIsCreating(false);
      showError(formatAppError(signUpError ?? new Error("Failed to create child login account.")));
      return;
    }

    const { error: insertError } = await supabase.from("children").insert({
      parent_id: parentUser.id,
      child_user_id: signUpData.user.id,
      login_email: newChildEmail.trim().toLowerCase(),
      login_secret: loginSecret,
      auth_pin: pin,
      name: newChildName.trim(),
      birthday: birthdayResult.birthday,
    });

    setIsCreating(false);
    if (insertError) {
      showError(formatAppError(insertError));
      return;
    }

    setNewChildName("");
    setNewChildBirthday(defaultBirthdayForNewChild());
    setNewChildEmail("");
    setShowCreateDialog(false);
    showSuccess(`Child registered! PIN: ${pin}`);
    await loadChildren(false, true);
  };

  const saveChildBirthday = async (childId: string, birthday: string) => {
    if (!supabase) {
      return;
    }
    const validated = validateBirthdayIso(birthday);
    if (!validated.ok) {
      showError(validated.message);
      return;
    }
    setBirthdaySaving(true);
    const { error: updateError } = await supabase
      .from("children")
      .update({ birthday: validated.birthday })
      .eq("id", childId);
    setBirthdaySaving(false);
    if (updateError) {
      showError(formatAppError(updateError));
      return;
    }
    showSuccess(`Birthday updated · now age ${validated.age}`);
    await loadChildren(false, true);
  };

  const regeneratePin = async (childId: string) => {
    if (!supabase) {
      return;
    }
    const pin = generatePin();
    setPinBusyChildId(childId);
    const { error: pinError } = await supabase.from("children").update({ auth_pin: pin }).eq("id", childId);
    setPinBusyChildId((prev) => (prev === childId ? null : prev));
    if (pinError) {
      showError(formatAppError(pinError));
      return;
    }
    showSuccess(`PIN updated · ${pin}`);
    await loadChildren(false, true);
  };

  const openAssignExercise = (child: ChildRow) => {
    const def = EXERCISES[0];
    setExerciseTarget(child);
    setExerciseId(def.id);
    setExerciseReps(String(def.defaultReps));
    setExercisePoints(String(def.defaultPoints));
  };

  const assignExercise = async () => {
    if (!supabase || !exerciseTarget) {
      return;
    }
    const reps = Number(exerciseReps);
    const pts = Number(exercisePoints);
    if (Number.isNaN(reps) || reps <= 0 || reps > 999) {
      showError("Exercise reps must be a valid number.");
      return;
    }
    if (Number.isNaN(pts) || pts < 0 || pts > 9999) {
      showError("Exercise points must be a valid number.");
      return;
    }

    const {
      data: { user },
      error: uError,
    } = await supabase.auth.getUser();
    if (uError || !user) {
      showError(formatAppError(uError ?? new Error("Not signed in.")));
      return;
    }

    setAssigning(true);
    const def = EXERCISES.find((e) => e.id === exerciseId) ?? EXERCISES[0];
    const payload = {
      child_id: exerciseTarget.id,
      category: "exercise",
      title: def.title,
      description: JSON.stringify({ exerciseId, targetReps: reps, minutes: def.defaultMinutes }),
      xp_reward: pts,
      requires_camera: false,
      status: "pending",
      created_by: user.id,
    };
    const { error: insError } = await supabase.from("tasks").insert(payload);
    setAssigning(false);

    if (insError) {
      showError(formatAppError(insError));
      return;
    }

    setExerciseTarget(null);
    showSuccess(`Exercise assigned: ${def.title} (${reps} reps)`);
  };

  const openAssignLearning = (child: ChildRow) => {
    setLearningTarget(child);
    setLearningGameId("alphabet");
    setLearningDifficulty("medium");
  };

  const assignLearning = async () => {
    if (!supabase || !learningTarget) {
      return;
    }
    const {
      data: { user },
      error: uError,
    } = await supabase.auth.getUser();
    if (uError || !user) {
      showError(formatAppError(uError ?? new Error("Not signed in.")));
      return;
    }

    const game =
      getGamesForChildAge(getChildAge(learningTarget)).find((g) => g.id === learningGameId) ??
      getGamesForChildAge(getChildAge(learningTarget))[0];
    if (!game) {
      showError("No learning games are available for this child's age.");
      return;
    }
    const difficultyLevel = difficultyTierToLevel(learningDifficulty);
    const xpReward = learningTaskXpReward(learningDifficulty, game.id);
    setAssigningLearning(true);
    const payload = {
      child_id: learningTarget.id,
      category: "learning",
      title: game.title,
      description: JSON.stringify({ gameId: game.id, difficultyLevel, difficultyTier: learningDifficulty }),
      xp_reward: xpReward,
      requires_camera: false,
      status: "pending",
      created_by: user.id,
    };
    const { error: insError } = await supabase.from("tasks").insert(payload);
    setAssigningLearning(false);
    if (insError) {
      showError(formatAppError(insError));
      return;
    }
    setLearningTarget(null);
    showSuccess(`Learning task assigned: ${game.title} (${difficultyTierLabel(learningDifficulty)}, +${xpReward} stars)`);
  };

  const openAssignChore = (child: ChildRow) => {
    setChoreTarget(child);
    setChoreTitle("");
    setChorePoints("30");
  };

  const assignChore = async () => {
    if (!supabase || !choreTarget) {
      return;
    }
    if (!choreTitle.trim()) {
      showError("Chore title is required.");
      return;
    }
    const pts = Number(chorePoints);
    if (Number.isNaN(pts) || pts < 0 || pts > 9999) {
      showError("Chore points must be a valid number.");
      return;
    }
    const {
      data: { user },
      error: uError,
    } = await supabase.auth.getUser();
    if (uError || !user) {
      showError(formatAppError(uError ?? new Error("Not signed in.")));
      return;
    }

    setAssigningChore(true);
    const payload = {
      child_id: choreTarget.id,
      category: "chore",
      title: choreTitle.trim(),
      description: JSON.stringify({ requiresPhoto: true }),
      xp_reward: pts,
      requires_camera: true,
      status: "pending",
      created_by: user.id,
    };
    const { error: insError } = await supabase.from("tasks").insert(payload);
    setAssigningChore(false);
    if (insError) {
      showError(formatAppError(insError));
      return;
    }
    setChoreTarget(null);
    showSuccess(`Chore assigned: ${choreTitle.trim()}`);
  };

  const onRefresh = useCallback(() => {
    void loadChildren(true);
    if (selectedChildId) {
      void loadScreenRules(selectedChildId);
      void loadSubmissionsPreview(selectedChildId);
      void loadUsedApps(selectedChildId);
    }
  }, [loadChildren, loadScreenRules, loadSubmissionsPreview, loadUsedApps, selectedChildId]);

  const selectedChild = useMemo(() => children.find((c) => c.id === selectedChildId) ?? null, [children, selectedChildId]);
  const selectedDraft = useMemo(() => {
    if (!selectedChild) {
      return null;
    }
    const draft = drafts[selectedChild.id];
    return draft
      ? draft
      : {
          daily_limit_minutes: String(selectedChild.daily_limit_minutes),
          difficulty_level: levelToDifficultyTier(selectedChild.difficulty_level),
          bedtime_start: formatBedtimeForInput(selectedChild.bedtime_start),
          bedtime_end: formatBedtimeForInput(selectedChild.bedtime_end),
          screen_limit_enabled: selectedChild.screen_limit_enabled !== false,
          bedtime_enabled: selectedChild.bedtime_enabled !== false,
        };
  }, [drafts, selectedChild]);

  const selectedAudioRate = selectedChild?.audio_guide_rate ?? 0.92;

  /** Apps the child has actually used, plus any custom-blocked package, excluding curated tiles. */
  const customBlockableApps = useMemo(() => {
    const blocked = screenRule?.blocked_apps_json ?? [];
    const map = new Map<string, string>();
    for (const app of usedApps) {
      if (isCuratedPackage(app.package_name)) continue;
      map.set(app.package_name, displayAppUsageLabel(app.app_label, app.package_name));
    }
    for (const pkg of blocked) {
      if (isCuratedPackage(pkg)) continue;
      if (!map.has(pkg)) {
        map.set(pkg, labelForPackage(pkg));
      }
    }
    return Array.from(map, ([pkg, label]) => ({ pkg, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [usedApps, screenRule?.blocked_apps_json]);

  const blockedForPricing = useMemo(
    () => (screenRule ? blockedAppsForDisplay(screenRule.blocked_apps_json) : []),
    [screenRule?.blocked_apps_json, screenRule]
  );

  const setUnlockPricingEntry = (key: string, entry: UnlockPricingEntry) => {
    setScreenRule((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        unlock_pricing_json: { ...prev.unlock_pricing_json, [key]: entry },
      };
    });
  };

  const ruleSummary = useMemo(() => {
    if (!selectedChild || !selectedDraft) {
      return "";
    }
    const dailyMinutes = Number.parseInt(selectedDraft.daily_limit_minutes, 10);
    const dailyLabel = Number.isFinite(dailyMinutes)
      ? formatDailyLimitSummary(dailyMinutes)
      : `${selectedChild.daily_limit_minutes} min`;
    const limitPart = selectedDraft.screen_limit_enabled ? `${dailyLabel} daily limit` : "Screen limit off";
    const bedPart = selectedDraft.bedtime_enabled
      ? `Bedtime ${formatBedtime12h(selectedDraft.bedtime_start)} to ${formatBedtime12h(selectedDraft.bedtime_end)}`
      : "Bedtime off";
    return `Current rule: ${limitPart} • ${bedPart} • Sound: ${audioRateLabel(selectedAudioRate)}`;
  }, [selectedChild, selectedDraft, selectedAudioRate]);

  const removeChildAccount = async () => {
    if (!supabase || !childToDelete) {
      return;
    }
    setDeleteBusy(true);
    const removedId = childToDelete.id;
    const { error } = await supabase.from("children").delete().eq("id", removedId);
    setDeleteBusy(false);
    if (error) {
      showError(formatAppError(error));
      return;
    }
    setChildToDelete(null);
    setChildPickerVisible(false);
    if (selectedChildId === removedId) {
      setSelectedChildId(null);
    }
    showSuccess(`${childToDelete.name} was removed.`);
    await loadChildren(false, true);
  };

  const formatSubmissionTime = (iso: string) => {
    const date = new Date(iso);
    const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `Photo submitted at ${time}`;
  };

  return (
    <ScreenContainer scroll onRefresh={onRefresh} refreshing={refreshing}>
      <Text variant="titleMedium" style={styles.kicker}>
        Child location, tasks, screen time, and app controls.
      </Text>

      {isEmpty ? <Text>No children found for this parent account yet.</Text> : null}

      {children.length > 0 ? (
        <Card style={styles.childCard}>
          <Card.Content style={styles.cardContent}>
            <ParentSectionHeader
              icon="account-child"
              title="Selected Child"
              subtitle="Pick a child to view their PIN and controls."
              style={styles.sectionHeaderInCard}
            />
            <Pressable
              onPress={() => setChildPickerVisible(true)}
              style={styles.childSelectorRow}
              accessibilityRole="button"
              accessibilityLabel="Select child"
            >
              {selectedChild?.avatar_url ? (
                <Image source={{ uri: selectedChild.avatar_url }} style={styles.childSelectorAvatar} />
              ) : (
                <View style={styles.childSelectorAvatarFallback}>
                  <Text style={styles.childSelectorAvatarLetter}>
                    {(selectedChild?.name ?? "?").slice(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text variant="titleMedium" style={styles.childSelectorName}>
                {selectedChild
                  ? `${selectedChild.name} (${formatChildAgeLine(selectedChild).split(" · ")[0]})`
                  : "Select child"}
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={24} color={c.subtext} />
            </Pressable>

            {selectedChild ? (
              <>
                <View style={styles.pinRow}>
                  <View style={styles.pinLeft}>
                    <MaterialCommunityIcons name="lock" size={18} color={c.pinIcon} />
                    <Text variant="titleSmall" style={styles.pinLabel}>
                      PIN: {selectedChild.auth_pin}
                    </Text>
                  </View>
                  <PrimaryButton
                    label="Regenerate"
                    mode="text"
                    onPress={() => void regeneratePin(selectedChild.id)}
                    loading={pinBusyChildId === selectedChild.id}
                  />
                </View>
                <Text variant="bodySmall" style={styles.pinHint}>
                  Child signs in using name + this PIN.
                </Text>
                <View style={styles.birthdayRow}>
                  <View style={styles.birthdayText}>
                    <Text variant="titleSmall" style={{ color: c.text, fontWeight: "600" }}>
                      Birthday
                    </Text>
                    <Text variant="bodySmall" style={{ color: c.subtext }}>
                      {formatChildAgeLine(selectedChild)}
                    </Text>
                  </View>
                  <PrimaryButton
                    label="Change"
                    mode="text"
                    onPress={() => setBirthdayPickerMode("edit")}
                    loading={birthdaySaving}
                    disabled={birthdaySaving}
                  />
                </View>
                <PrimaryButton label="+ Register Child" mode="outlined" onPress={() => setShowCreateDialog(true)} />
              </>
            ) : null}
          </Card.Content>
        </Card>
      ) : null}

      {selectedChild && selectedDraft ? (
        <>
          <Card style={styles.childCard}>
            <Card.Content style={styles.cardContent}>
              <ParentSectionHeader
                icon="map-marker-radius"
                title="Live Location"
                subtitle="See where your child is right now on the map."
                style={styles.sectionHeaderInCard}
              />
              <ParentChildLocationPreview
                children={children.map((c) => ({
                  id: c.id,
                  name: c.name,
                  avatar_url: c.avatar_url,
                  is_online: c.is_online,
                  last_seen_at: c.last_seen_at,
                }))}
                selectedChildId={selectedChildId}
              />
            </Card.Content>
          </Card>

          <Card style={styles.childCard}>
            <Card.Content style={styles.cardContent}>
              <ParentSectionHeader
                icon="target"
                title="Assign Tasks & Activities"
                subtitle="Games, chores, and exercise for this child."
                style={styles.sectionHeaderInCard}
              />
              <View style={styles.assignRow}>
                <PrimaryButton label="Learning Game" mode="outlined" onPress={() => openAssignLearning(selectedChild)} />
                <PrimaryButton label="Household Chore" mode="outlined" onPress={() => openAssignChore(selectedChild)} />
                <PrimaryButton label="Exercise" mode="outlined" onPress={() => openAssignExercise(selectedChild)} />
              </View>
              <Divider />
              <Text variant="labelLarge" style={styles.subSectionTitle}>
                Sound / Audio Guidance Speed
              </Text>
              <View style={styles.chipRow}>
                <Chip selected={selectedAudioRate <= 0.86} onPress={() => void updateAudioRate(selectedChild.id, 0.84)} compact>
                  Slow
                </Chip>
                <Chip
                  selected={selectedAudioRate > 0.86 && selectedAudioRate < 0.98}
                  onPress={() => void updateAudioRate(selectedChild.id, 0.92)}
                  compact
                >
                  Medium
                </Chip>
                <Chip selected={selectedAudioRate >= 0.98} onPress={() => void updateAudioRate(selectedChild.id, 1.05)} compact>
                  Fast
                </Chip>
              </View>
            </Card.Content>
          </Card>

          <Card
            style={[
              styles.childCard,
              submissionsHighlight && { borderColor: c.warning, borderWidth: 2 },
            ]}
          >
            <Card.Content style={styles.cardContent}>
              <ParentSectionHeader
                icon="clipboard-check-outline"
                title="Review Submitted Tasks"
                subtitle="Approve photos or send chores back for retry."
                style={styles.sectionHeaderInCard}
              />
              {submissionRows.length === 0 ? (
                <Text variant="bodySmall" style={styles.helper}>
                  No submissions waiting for review.
                </Text>
              ) : null}
              {submissionRows.map((row) => (
                <View key={row.id} style={styles.reviewRow}>
                  <View style={styles.reviewRowMain}>
                    <View style={styles.reviewRowText}>
                      <Text variant="titleSmall" style={styles.reviewTitle}>
                        {row.tasks?.title ?? "Task"}
                      </Text>
                      <Text variant="bodySmall" style={styles.helper}>
                        {row.image_url ? formatSubmissionTime(row.created_at) : "Waiting for parent review"}
                      </Text>
                    </View>
                    <View style={styles.reviewIconActions}>
                      <IconButton
                        icon="check"
                        mode="contained"
                        containerColor={c.primary}
                        iconColor="#FFFFFF"
                        size={20}
                        onPress={() => void approveSubmission(row)}
                        disabled={reviewBusyId === row.id}
                        accessibilityLabel="Approve submission"
                      />
                      <IconButton
                        icon="close"
                        mode="contained"
                        containerColor="#FEE2E2"
                        iconColor="#B91C1C"
                        size={20}
                        onPress={() => {
                          setRejectTarget(row);
                          setRejectNote("");
                        }}
                        disabled={reviewBusyId === row.id}
                        accessibilityLabel="Reject submission"
                      />
                    </View>
                  </View>
                  {row.image_url && submissionImageUrls[row.id] ? (
                    <Image source={{ uri: submissionImageUrls[row.id] }} style={styles.reviewImage} resizeMode="cover" />
                  ) : null}
                </View>
              ))}
            </Card.Content>
          </Card>

          <Card style={styles.childCard}>
            <Card.Content style={styles.cardContent}>
              <ParentSectionHeader
                icon="timer-outline"
                title="Screen Time & Bedtime"
                subtitle="Turn limits on or off, then adjust values."
                style={styles.sectionHeaderInCard}
              />
              <View style={styles.toggleRow}>
                <Text variant="labelLarge" style={{ color: c.text, fontWeight: "700" }}>
                  Screen time
                </Text>
                <Switch
                  value={selectedDraft.screen_limit_enabled}
                  onValueChange={(screen_limit_enabled) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [selectedChild.id]: { ...selectedDraft, screen_limit_enabled },
                    }))
                  }
                />
              </View>
              <StepperControl
                label="Daily Screen Limit"
                value={formatDailyLimitDisplay(selectedDraft.daily_limit_minutes, selectedChild.daily_limit_minutes)}
                disabled={!selectedDraft.screen_limit_enabled}
                onValuePress={() => selectedDraft.screen_limit_enabled && setDurationPickerOpen(true)}
                onDecrement={() =>
                  setDrafts((prev) => ({
                    ...prev,
                    [selectedChild.id]: {
                      ...selectedDraft,
                      daily_limit_minutes: stepDailyLimit(
                        selectedDraft.daily_limit_minutes,
                        selectedChild.daily_limit_minutes,
                        -1
                      ),
                    },
                  }))
                }
                onIncrement={() =>
                  setDrafts((prev) => ({
                    ...prev,
                    [selectedChild.id]: {
                      ...selectedDraft,
                      daily_limit_minutes: stepDailyLimit(
                        selectedDraft.daily_limit_minutes,
                        selectedChild.daily_limit_minutes,
                        1
                      ),
                    },
                  }))
                }
                decrementAccessibilityLabel="Decrease daily screen limit"
                incrementAccessibilityLabel="Increase daily screen limit"
              />
              <View style={styles.toggleRow}>
                <Text variant="labelLarge" style={{ color: c.text, fontWeight: "700" }}>
                  Bedtime
                </Text>
                <Switch
                  value={selectedDraft.bedtime_enabled}
                  onValueChange={(bedtime_enabled) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [selectedChild.id]: { ...selectedDraft, bedtime_enabled },
                    }))
                  }
                />
              </View>
              <StepperControl
                label="Bedtime Start"
                value={formatBedtime12h(selectedDraft.bedtime_start)}
                disabled={!selectedDraft.bedtime_enabled}
                onValuePress={() => selectedDraft.bedtime_enabled && setBedtimePickerField("start")}
                onDecrement={() =>
                  setDrafts((prev) => ({
                    ...prev,
                    [selectedChild.id]: {
                      ...selectedDraft,
                      bedtime_start: stepBedtime(selectedDraft.bedtime_start, -1),
                    },
                  }))
                }
                onIncrement={() =>
                  setDrafts((prev) => ({
                    ...prev,
                    [selectedChild.id]: {
                      ...selectedDraft,
                      bedtime_start: stepBedtime(selectedDraft.bedtime_start, 1),
                    },
                  }))
                }
                decrementAccessibilityLabel="Earlier bedtime start"
                incrementAccessibilityLabel="Later bedtime start"
              />
              <StepperControl
                label="Bedtime End"
                value={formatBedtime12h(selectedDraft.bedtime_end)}
                disabled={!selectedDraft.bedtime_enabled}
                onValuePress={() => selectedDraft.bedtime_enabled && setBedtimePickerField("end")}
                onDecrement={() =>
                  setDrafts((prev) => ({
                    ...prev,
                    [selectedChild.id]: {
                      ...selectedDraft,
                      bedtime_end: stepBedtime(selectedDraft.bedtime_end, -1),
                    },
                  }))
                }
                onIncrement={() =>
                  setDrafts((prev) => ({
                    ...prev,
                    [selectedChild.id]: {
                      ...selectedDraft,
                      bedtime_end: stepBedtime(selectedDraft.bedtime_end, 1),
                    },
                  }))
                }
                decrementAccessibilityLabel="Earlier bedtime end"
                incrementAccessibilityLabel="Later bedtime end"
              />
              {ruleSummary ? (
                <View style={styles.ruleSummaryBox}>
                  <Text variant="bodySmall" style={styles.ruleSummaryText}>
                    {ruleSummary}
                  </Text>
                </View>
              ) : null}
            </Card.Content>
          </Card>

          <Card style={styles.childCard}>
            <Card.Content style={styles.cardContent}>
              <ParentSectionHeader
                icon="cancel"
                title="Block Distracting Apps"
                subtitle="Tap an app to block or unblock it on the child's phone."
                style={styles.sectionHeaderInCard}
              />
              <Text variant="bodySmall" style={styles.helper}>
                One tap blocks every common install variant (e.g. TikTok and TikTok Lite).
              </Text>
              <View style={styles.appGrid}>
                {BLOCKABLE_APP_GROUPS.map((app) => {
                  const selected = screenRule ? isGroupFullySelected(screenRule.blocked_apps_json, app) : false;
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
                      disabled={!screenRule}
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

              <View style={styles.usedAppsHeader}>
                <Text variant="titleSmall" style={styles.usedAppsTitle}>
                  Apps {selectedChild.name} has used
                </Text>
              </View>
              {customBlockableApps.length > 0 ? (
                <>
                  <Text variant="bodySmall" style={styles.helper}>
                    Block any other app seen on {selectedChild.name}'s phone. New apps appear here after they are opened.
                  </Text>
                  <View style={styles.appGrid}>
                    {customBlockableApps.map((app) => {
                      const selected = screenRule ? isPackageBlocked(screenRule.blocked_apps_json, app.pkg) : false;
                      return (
                        <Pressable
                          key={app.pkg}
                          accessibilityRole="button"
                          accessibilityLabel={`Toggle ${app.label}`}
                          style={[
                            styles.appTile,
                            {
                              backgroundColor: selected ? theme.colors.primary : theme.colors.surfaceVariant,
                              borderColor: selected ? theme.colors.primary : theme.colors.outline,
                            },
                          ]}
                          onPress={() => toggleBlockedPackage(app.pkg)}
                          disabled={!screenRule}
                        >
                          <MaterialCommunityIcons
                            name={iconForPackage(app.pkg)}
                            size={22}
                            color={selected ? theme.colors.onPrimary : theme.colors.primary}
                          />
                          <Text
                            variant="bodySmall"
                            numberOfLines={1}
                            style={[styles.appTileLabel, { color: selected ? theme.colors.onPrimary : theme.colors.onSurface }]}
                          >
                            {app.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : (
                <Text variant="bodySmall" style={styles.helper}>
                  No other apps recorded yet. Once {selectedChild.name} opens an app on their phone, it will show up here so
                  you can block it.
                </Text>
              )}

              {usedApps.length > 0 ? (
                <Pressable
                  onPress={() => setClearUsageConfirm(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Clear recorded app history"
                  style={styles.clearHistoryRow}
                  hitSlop={8}
                >
                  <MaterialCommunityIcons name="broom" size={16} color={theme.colors.error} />
                  <Text variant="bodySmall" style={[styles.clearHistoryText, { color: theme.colors.error }]}>
                    Clear recorded app history
                  </Text>
                </Pressable>
              ) : null}
            </Card.Content>
          </Card>

          <Card style={styles.childCard}>
            <Card.Content style={styles.cardContent}>
              <ParentSectionHeader
                icon="star-circle-outline"
                title="Star unlock pricing"
                subtitle="Children can spend weekly stars to ask you to temporarily unlock blocked apps. You still approve every request."
                style={styles.sectionHeaderInCard}
              />
              <List.Item
                title="Allow star unlock requests"
                description="When off, blocked apps cannot be unlocked with stars."
                right={() => (
                  <Switch
                    value={screenRule?.app_unlock_enabled !== false}
                    onValueChange={(on) =>
                      setScreenRule((prev) => (prev ? { ...prev, app_unlock_enabled: on } : prev))
                    }
                    disabled={!screenRule}
                  />
                )}
              />
              {blockedForPricing.length === 0 ? (
                <Text variant="bodySmall" style={styles.helper}>
                  Block at least one app above to set star prices for unlock requests.
                </Text>
              ) : screenRule?.app_unlock_enabled !== false ? (
                blockedForPricing.map((app) => {
                  if (!screenRule) return null;
                  const entry = screenRule.unlock_pricing_json[app.key] ?? { mode: "suggested" as const };
                  const mode = entry.mode ?? "suggested";
                  return (
                    <View key={app.key} style={[styles.unlockPricingRow, { borderColor: theme.colors.outlineVariant }]}>
                      <View style={styles.unlockPricingHead}>
                        <MaterialCommunityIcons name={app.icon} size={20} color={theme.colors.primary} />
                        <Text variant="titleSmall" style={styles.unlockPricingLabel}>
                          {app.label}
                        </Text>
                      </View>
                      <View style={styles.unlockModeRow}>
                        {(["suggested", "fixed", "disabled"] as const).map((m) => {
                          const selected = mode === m;
                          return (
                            <Chip
                              key={m}
                              compact
                              selected={selected}
                              onPress={() =>
                                setUnlockPricingEntry(app.key, {
                                  mode: m,
                                  fixed_stars: m === "fixed" ? entry.fixed_stars ?? 15 : undefined,
                                })
                              }
                              style={styles.unlockModeChip}
                            >
                              {m === "suggested" ? "Suggested" : m === "fixed" ? "Fixed" : "Off"}
                            </Chip>
                          );
                        })}
                      </View>
                      {mode === "fixed" ? (
                        <StepperControl
                          label="Stars for rest of today"
                          value={`${entry.fixed_stars ?? 15} ★`}
                          onDecrement={() => {
                            const next = Math.max(3, (entry.fixed_stars ?? 15) - 1);
                            setUnlockPricingEntry(app.key, { mode: "fixed", fixed_stars: next });
                          }}
                          onIncrement={() => {
                            const next = Math.min(100, (entry.fixed_stars ?? 15) + 1);
                            setUnlockPricingEntry(app.key, { mode: "fixed", fixed_stars: next });
                          }}
                          decrementAccessibilityLabel="Fewer stars"
                          incrementAccessibilityLabel="More stars"
                        />
                      ) : (
                        <Text variant="bodySmall" style={styles.helper}>
                          {mode === "fixed"
                            ? "30 min and until Monday scale from this rest-of-today price."
                            : pricingModeLabel(mode)}
                        </Text>
                      )}
                    </View>
                  );
                })
              ) : null}
            </Card.Content>
          </Card>

          <PrimaryButton
            label="Save Changes"
            onPress={() => void saveAllForChild(selectedChild.id)}
            loading={saveBusyChildId === selectedChild.id}
          />
        </>
      ) : null}

      {selectedChild && selectedDraft ? (
        <>
          <DurationPickerModal
            visible={durationPickerOpen}
            totalMinutes={parseDailyLimitValue(selectedDraft.daily_limit_minutes, selectedChild.daily_limit_minutes)}
            onDismiss={() => setDurationPickerOpen(false)}
            onConfirm={(minutes) =>
              setDrafts((prev) => ({
                ...prev,
                [selectedChild.id]: { ...selectedDraft, daily_limit_minutes: String(minutes) },
              }))
            }
          />
          <BedtimePickerModal
            visible={bedtimePickerField === "start"}
            value24h={selectedDraft.bedtime_start}
            title="Bedtime start"
            onDismiss={() => setBedtimePickerField(null)}
            onConfirm={(hhmm) =>
              setDrafts((prev) => ({
                ...prev,
                [selectedChild.id]: { ...selectedDraft, bedtime_start: hhmm },
              }))
            }
          />
          <BedtimePickerModal
            visible={bedtimePickerField === "end"}
            value24h={selectedDraft.bedtime_end}
            title="Bedtime end"
            onDismiss={() => setBedtimePickerField(null)}
            onConfirm={(hhmm) =>
              setDrafts((prev) => ({
                ...prev,
                [selectedChild.id]: { ...selectedDraft, bedtime_end: hhmm },
              }))
            }
          />
        </>
      ) : null}

      <BirthdayPickerModal
        visible={birthdayPickerMode !== null}
        birthdayIso={
          birthdayPickerMode === "create"
            ? newChildBirthday
            : selectedChild?.birthday ?? defaultBirthdayForNewChild()
        }
        title={
          birthdayPickerMode === "create"
            ? "Child's birthday"
            : `Birthday for ${selectedChild?.name ?? "child"}`
        }
        onDismiss={() => setBirthdayPickerMode(null)}
        onConfirm={(iso) => {
          if (birthdayPickerMode === "create") {
            setNewChildBirthday(iso);
            setBirthdayPickerMode(null);
            return;
          }
          if (birthdayPickerMode === "edit" && selectedChild) {
            void saveChildBirthday(selectedChild.id, iso);
            setBirthdayPickerMode(null);
          }
        }}
      />

      <ParentManageToast
        visible={toast != null}
        message={toast?.message ?? ""}
        variant={toast?.variant ?? "success"}
        onHide={hideToast}
        durationMs={toast?.variant === "error" ? 4500 : 3200}
      />

      <Portal>
        <Dialog visible={childPickerVisible} onDismiss={() => setChildPickerVisible(false)} style={styles.pickerDialog}>
          <Dialog.Title>Select child</Dialog.Title>
          <Dialog.Content style={styles.pickerDialogContent}>
            <ScrollView
              style={styles.pickerScroll}
              contentContainerStyle={styles.pickerScrollContent}
              nestedScrollEnabled
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
            >
              {children.map((child) => (
                <View key={child.id} style={[styles.pickerRow, { borderBottomColor: c.border }]}>
                  <Pressable
                    style={styles.pickerRowMain}
                    onPress={() => {
                      setSelectedChildId(child.id);
                      setChildPickerVisible(false);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${child.name}`}
                  >
                    {child.avatar_url ? (
                      <Image source={{ uri: child.avatar_url }} style={styles.pickerListAvatar} />
                    ) : (
                      <View style={styles.pickerListAvatarFallback}>
                        <Text style={styles.pickerListAvatarLetter}>{child.name.slice(0, 1).toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={styles.pickerRowText}>
                      <Text variant="titleSmall" style={{ color: c.text, fontWeight: "700" }}>
                        {child.name}
                      </Text>
                      <Text variant="bodySmall" style={{ color: c.subtext }}>
                        {formatChildAgeLine(child)}
                      </Text>
                    </View>
                  </Pressable>
                  <IconButton
                    icon="delete-outline"
                    iconColor="#B91C1C"
                    size={22}
                    onPress={() => setChildToDelete(child)}
                    accessibilityLabel={`Remove ${child.name}`}
                  />
                </View>
              ))}
            </ScrollView>
          </Dialog.Content>
        </Dialog>

        <Dialog visible={Boolean(childToDelete)} onDismiss={() => !deleteBusy && setChildToDelete(null)}>
          <Dialog.Title>Remove child?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Remove {childToDelete?.name ?? "this child"} from your account? Their tasks and history will be deleted.
              This cannot be undone.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <PrimaryButton label="Cancel" mode="text" onPress={() => setChildToDelete(null)} disabled={deleteBusy} />
            <PrimaryButton
              label={deleteBusy ? "Removing…" : "Remove"}
              onPress={() => void removeChildAccount()}
              disabled={deleteBusy}
            />
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={clearUsageConfirm}
          onDismiss={() => !clearingUsage && setClearUsageConfirm(false)}
        >
          <Dialog.Title>Clear app history?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              This clears the list of recorded apps for {selectedChild?.name ?? "this child"}. Apps you have already blocked
              stay blocked, and apps will reappear here as they are opened again.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <PrimaryButton
              label="Cancel"
              mode="text"
              onPress={() => setClearUsageConfirm(false)}
              disabled={clearingUsage}
            />
            <PrimaryButton
              label={clearingUsage ? "Clearing…" : "Clear"}
              onPress={() => void clearUsedAppHistory()}
              disabled={clearingUsage}
            />
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={showCreateDialog} onDismiss={() => setShowCreateDialog(false)}>
          <Dialog.Title>Create Child Account</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodySmall" style={styles.helper}>
              Parent creates child login + PIN in one step.
            </Text>
            <TextInput label="Child Name" mode="outlined" value={newChildName} onChangeText={setNewChildName} />
            <Pressable onPress={() => setBirthdayPickerMode("create")} accessibilityRole="button">
              <View pointerEvents="none">
                <TextInput
                  label="Birthday"
                  mode="outlined"
                  value={formatBirthdayDisplay(newChildBirthday)}
                  editable={false}
                  right={<TextInput.Icon icon="calendar" />}
                />
              </View>
            </Pressable>
            <Text variant="bodySmall" style={styles.helper}>
              {childBirthdayFieldHelper()}
            </Text>
            <TextInput
              label="Child Email"
              mode="outlined"
              value={newChildEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setNewChildEmail}
            />
            <Text variant="bodySmall" style={styles.helper}>
              By creating this profile you confirm you are the parent or guardian and consent to LearnGate collecting
              this child&apos;s learning, location, and app-usage data as described in Settings → Legal.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <PrimaryButton label="Cancel" mode="text" onPress={() => setShowCreateDialog(false)} />
            <PrimaryButton
              label={isCreating ? "Creating..." : "Create"}
              onPress={() => void createChildAccount()}
              disabled={isCreating}
            />
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={Boolean(exerciseTarget)} onDismiss={() => setExerciseTarget(null)}>
          <Dialog.Title>Assign physical exercise</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodySmall" style={styles.helper}>
              Assign an exercise to {exerciseTarget?.name ?? "child"}. Camera pose tracking will count their
              reps.
            </Text>
            <View style={styles.chipRow}>
              {EXERCISES.map((ex) => (
                <Chip
                  key={ex.id}
                  selected={exerciseId === ex.id}
                  onPress={() => {
                    setExerciseId(ex.id);
                    setExerciseReps(String(ex.defaultReps));
                    setExercisePoints(String(ex.defaultPoints));
                  }}
                >
                  {ex.emoji} {ex.title}
                </Chip>
              ))}
            </View>
            {(() => {
              const selected = EXERCISES.find((e) => e.id === exerciseId) ?? EXERCISES[0];
              return (
                <Text variant="bodySmall" style={[styles.helper, { marginBottom: 8 }]}>
                  {selected.cardDescription}
                </Text>
              );
            })()}
            <TextInput
              label="Target reps"
              mode="outlined"
              value={exerciseReps}
              keyboardType="number-pad"
              onChangeText={(v) => setExerciseReps(v.replace(/[^0-9]/g, "").slice(0, 3))}
            />
            <TextInput
              label="Reward points (stars)"
              mode="outlined"
              value={exercisePoints}
              keyboardType="number-pad"
              onChangeText={(v) => setExercisePoints(v.replace(/[^0-9]/g, "").slice(0, 4))}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <PrimaryButton label="Cancel" mode="text" onPress={() => setExerciseTarget(null)} />
            <PrimaryButton
              label={assigning ? "Assigning..." : "Assign"}
              onPress={() => void assignExercise()}
              disabled={assigning}
            />
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={Boolean(learningTarget)} onDismiss={() => setLearningTarget(null)}>
          <Dialog.Title>Assign learning game</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodySmall" style={styles.helper}>
              Games match {learningTarget?.name}&apos;s age ({learningTargetAgeBand?.label},{" "}
              {learningTargetAgeBand?.shortLabel}).
            </Text>
            <Text variant="labelMedium" style={[styles.subSectionTitle, { marginTop: 8 }]}>
              Game
            </Text>
            <View style={styles.chipRow}>
              {assignableLearningGames.map((g) => (
                <Chip key={g.id} selected={learningGameId === g.id} onPress={() => setLearningGameId(g.id)}>
                  {g.title}
                </Chip>
              ))}
            </View>
            <Text variant="labelMedium" style={[styles.subSectionTitle, { marginTop: 8 }]}>
              Difficulty
            </Text>
            <View style={styles.chipRow}>
              {(["easy", "medium", "hard"] as const).map((tier) => (
                <Chip
                  key={tier}
                  selected={learningDifficulty === tier}
                  onPress={() => setLearningDifficulty(tier)}
                  compact
                >
                  {difficultyTierLabel(tier)}
                </Chip>
              ))}
            </View>
            <Text variant="bodySmall" style={[styles.helper, { marginTop: 4 }]}>
              Reward: +{learningTaskXpReward(learningDifficulty, learningGameId)} stars on completion
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <PrimaryButton label="Cancel" mode="text" onPress={() => setLearningTarget(null)} />
            <PrimaryButton label={assigningLearning ? "Assigning..." : "Assign"} onPress={() => void assignLearning()} disabled={assigningLearning} />
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={Boolean(choreTarget)} onDismiss={() => setChoreTarget(null)}>
          <Dialog.Title>Assign household chore</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodySmall" style={styles.helper}>
              Child will submit a photo, and you will approve or reject it.
            </Text>
            <TextInput label="Chore title" mode="outlined" value={choreTitle} onChangeText={setChoreTitle} />
            <TextInput
              label="Reward points (stars)"
              mode="outlined"
              value={chorePoints}
              keyboardType="number-pad"
              onChangeText={(v) => setChorePoints(v.replace(/[^0-9]/g, "").slice(0, 4))}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <PrimaryButton label="Cancel" mode="text" onPress={() => setChoreTarget(null)} />
            <PrimaryButton label={assigningChore ? "Assigning..." : "Assign"} onPress={() => void assignChore()} disabled={assigningChore} />
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={Boolean(rejectTarget)} onDismiss={() => setRejectTarget(null)}>
          <Dialog.Title>Reject submission</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">Optional note for your child:</Text>
            <TextInput mode="outlined" value={rejectNote} onChangeText={setRejectNote} multiline />
          </Dialog.Content>
          <Dialog.Actions>
            <PrimaryButton label="Cancel" onPress={() => setRejectTarget(null)} mode="text" />
            <PrimaryButton label="Confirm reject" onPress={() => void confirmRejectSubmission()} />
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
    marginBottom: 8,
  },
  childCard: {
    borderRadius: radii.md,
    backgroundColor: c.card,
    ...shadows.card,
  },
  sectionHeaderInCard: {
    marginBottom: 4,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  assignRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  cardContent: {
    gap: 10,
  },
  pickerDialog: {
    maxHeight: "85%",
  },
  pickerDialogContent: {
    paddingHorizontal: 0,
    paddingTop: 0,
    maxHeight: 360,
  },
  pickerScroll: {
    maxHeight: 360,
  },
  pickerScrollContent: {
    paddingBottom: 8,
  },
  pickerRowMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingLeft: 4,
  },
  pickerRowText: {
    flex: 1,
    minWidth: 0,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  pickerListAvatar: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    marginLeft: 8,
    backgroundColor: c.sectionIconBg,
  },
  pickerListAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    marginLeft: 8,
    backgroundColor: c.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerListAvatarLetter: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 16,
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
  sectionCard: {
    backgroundColor: c.mutedSurface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    padding: 12,
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  subSection: {
    gap: 8,
  },
  subSectionTitle: {
    color: c.text,
    fontWeight: "700",
  },
  twoColRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  twoColItem: {
    flex: 1,
    minWidth: 160,
  },
  helper: {
    color: c.subtext,
    lineHeight: 18,
  },
  pinRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  pinLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pinLabel: {
    color: c.primaryDark,
    fontWeight: "700",
  },
  pinHint: {
    color: c.subtext,
  },
  birthdayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  birthdayText: {
    flex: 1,
    gap: 2,
  },
  childSelectorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: c.card,
  },
  childSelectorAvatar: {
    width: 52,
    height: 52,
    borderRadius: radii.sm,
    backgroundColor: c.sectionIconBg,
  },
  childSelectorAvatarFallback: {
    width: 52,
    height: 52,
    borderRadius: radii.sm,
    backgroundColor: c.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  childSelectorAvatarLetter: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  childSelectorName: {
    flex: 1,
    fontWeight: "700",
    color: c.text,
  },
  sectionLabel: {
    color: c.text,
    fontWeight: "700",
  },
  reviewRow: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    padding: 10,
    gap: 8,
    backgroundColor: c.card,
  },
  reviewRowMain: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  reviewRowText: {
    flex: 1,
    gap: 2,
  },
  reviewTitle: {
    fontWeight: "700",
    color: c.text,
  },
  reviewIconActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  reviewImage: {
    width: "100%",
    height: 140,
    borderRadius: radii.sm,
    backgroundColor: c.border,
  },
  ruleSummaryBox: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    padding: 10,
    backgroundColor: c.mutedSurface,
  },
  ruleSummaryText: {
    color: c.subtext,
    lineHeight: 18,
  },
  appGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  usedAppsHeader: {
    marginTop: 16,
    marginBottom: 2,
  },
  usedAppsTitle: {
    fontWeight: "700",
    color: c.text,
  },
  clearHistoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    alignSelf: "flex-start",
  },
  clearHistoryText: {
    fontWeight: "600",
  },
  unlockPricingRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  unlockPricingHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  unlockPricingLabel: {
    fontWeight: "700",
  },
  unlockModeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  unlockModeChip: {
    marginRight: 0,
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
  });
}
