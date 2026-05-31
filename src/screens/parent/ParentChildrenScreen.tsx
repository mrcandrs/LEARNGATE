import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { createClient } from "@supabase/supabase-js";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Card, Chip, Dialog, Divider, IconButton, List, Portal, Text, TextInput, useTheme } from "react-native-paper";
import { ScreenContainer } from "@/components/ScreenContainer";
import { PrimaryButton } from "@/components/PrimaryButton";
import { StepperControl } from "@/components/parent/StepperControl";
import { DurationPickerModal } from "@/components/parent/DurationPickerModal";
import { BedtimePickerModal } from "@/components/parent/BedtimePickerModal";
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
import { CHILD_GAME_CATALOG } from "@/data/childGames";
import type { GameId } from "@/data/childGames";
import { difficultyTierLabel, difficultyTierToLevel, levelToDifficultyTier, rewardMultiplierForDifficultyLevel, type DifficultyTier } from "@/utils/difficulty";
import {
  BLOCKABLE_APP_GROUPS,
  isGroupFullySelected,
  toggleBlockedGroup as applyBlockedGroupToggle,
  type BlockableAppGroup,
} from "@/constants/blockedAppPackages";
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

type ManageToast = { message: string; variant: "success" | "error" };

type ChildRow = {
  id: string;
  child_user_id: string | null;
  login_email: string | null;
  login_secret: string | null;
  auth_pin: string;
  name: string;
  age: number;
  stars: number;
  daily_limit_minutes: number;
  difficulty_level: number;
  bedtime_start: string;
  bedtime_end: string;
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
};

export function ParentChildrenScreen() {
  const { isSupabaseConfigured } = useAuth();
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

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  const showError = useCallback((message: string) => {
    setToast({ message, variant: "error" });
  }, []);

  const showSuccess = useCallback((message: string) => {
    setToast({ message, variant: "success" });
  }, []);
  const [newChildName, setNewChildName] = useState("");
  const [newChildAge, setNewChildAge] = useState("");
  const [newChildEmail, setNewChildEmail] = useState("");
  const [exerciseTarget, setExerciseTarget] = useState<ChildRow | null>(null);
  const [exerciseId, setExerciseId] = useState<ExerciseId>("jumping_jacks");
  const [exerciseReps, setExerciseReps] = useState("10");
  const [exercisePoints, setExercisePoints] = useState("20");
  const [assigning, setAssigning] = useState(false);
  const [learningTarget, setLearningTarget] = useState<ChildRow | null>(null);
  const [learningGameId, setLearningGameId] = useState<GameId>("alphabet");
  const [learningPoints, setLearningPoints] = useState("30");
  const [choreTarget, setChoreTarget] = useState<ChildRow | null>(null);
  const [choreTitle, setChoreTitle] = useState("");
  const [chorePoints, setChorePoints] = useState("30");
  const [assigningLearning, setAssigningLearning] = useState(false);
  const [assigningChore, setAssigningChore] = useState(false);
  const [screenRule, setScreenRule] = useState<ScreenRule | null>(null);
  const [submissionRows, setSubmissionRows] = useState<SubmissionPreviewRow[]>([]);
  const [reviewBusyId, setReviewBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<SubmissionPreviewRow | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [submissionImageUrls, setSubmissionImageUrls] = useState<Record<string, string>>({});

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
        "id, child_user_id, login_email, login_secret, auth_pin, name, age, stars, daily_limit_minutes, difficulty_level, bedtime_start, bedtime_end, audio_guide_rate, avatar_url, is_online, last_seen_at"
      )
      .eq("parent_id", user.id)
      .order("created_at", { ascending: true });

    if (childrenError) {
      showError(formatAppError(childrenError));
      setIsLoading(false);
      setRefreshing(false);
      return;
    }

    const rows = (data as ChildRow[]) ?? [];
    const nextDrafts = rows.reduce<Record<string, ChildDraft>>((acc, row) => {
      acc[row.id] = {
        daily_limit_minutes: String(row.daily_limit_minutes),
        difficulty_level: levelToDifficultyTier(row.difficulty_level),
        bedtime_start: formatBedtimeForInput(row.bedtime_start),
        bedtime_end: formatBedtimeForInput(row.bedtime_end),
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
      .select("child_id, blocked_apps_json, unlock_after_task_count, reward_multiplier, daily_report_enabled, task_reminders_enabled")
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
    };
    setScreenRule((data as ScreenRule | null) ?? fallbackRule);
  }, [showError]);

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
      return;
    }
    void loadScreenRules(selectedChildId);
    void loadSubmissionsPreview(selectedChildId);
  }, [selectedChildId, loadScreenRules, loadSubmissionsPreview]);

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

    const difficulty = difficultyTierToLevel(draft.difficulty_level);

    const { error: updateError } = await supabase
      .from("children")
      .update({
        daily_limit_minutes: dailyLimit,
        difficulty_level: difficulty,
        bedtime_start: bedtimeStart,
        bedtime_end: bedtimeEnd,
      })
      .eq("id", childId);

    if (updateError) {
      const raw = updateError.message ?? "";
      showError(formatDailyLimitDbError(raw) ?? formatAppError(updateError));
      return false;
    }
    await loadChildren(false, true);
    return true;
  };

  const saveScreenRules = async (childId: string, difficultyLevel?: number): Promise<boolean> => {
    if (!supabase || !screenRule) {
      return false;
    }
    const rewardMultiplier =
      difficultyLevel != null ? rewardMultiplierForDifficultyLevel(difficultyLevel) : screenRule.reward_multiplier;
    const { error: upsertError } = await supabase.from("screen_rules").upsert(
      { ...screenRule, child_id: childId, reward_multiplier: rewardMultiplier },
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
      const difficultyLevel = selectedDraft ? difficultyTierToLevel(selectedDraft.difficulty_level) : undefined;
      const rulesOk = childOk ? await saveScreenRules(childId, difficultyLevel) : false;
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
    if (!newChildName.trim() || !newChildAge.trim() || !newChildEmail.trim()) {
      showError("Name, age, and child email are required.");
      return;
    }

    const age = Number(newChildAge);
    if (Number.isNaN(age) || age <= 0 || age >= 18) {
      showError("Child age must be between 1 and 17.");
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
      age,
    });

    setIsCreating(false);
    if (insertError) {
      showError(formatAppError(insertError));
      return;
    }

    setNewChildName("");
    setNewChildAge("");
    setNewChildEmail("");
    setShowCreateDialog(false);
    showSuccess(`Child registered! PIN: ${pin}`);
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
    setLearningPoints("30");
  };

  const assignLearning = async () => {
    if (!supabase || !learningTarget) {
      return;
    }
    const pts = Number(learningPoints);
    if (Number.isNaN(pts) || pts < 0 || pts > 9999) {
      showError("Learning points must be a valid number.");
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

    const game = CHILD_GAME_CATALOG.find((g) => g.id === learningGameId) ?? CHILD_GAME_CATALOG[0];
    setAssigningLearning(true);
    const payload = {
      child_id: learningTarget.id,
      category: "learning",
      title: game.title,
      description: JSON.stringify({ gameId: game.id }),
      xp_reward: pts,
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
    showSuccess(`Learning task assigned: ${game.title}`);
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
    }
  }, [loadChildren, loadScreenRules, loadSubmissionsPreview, selectedChildId]);

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
        };
  }, [drafts, selectedChild]);

  const selectedAudioRate = selectedChild?.audio_guide_rate ?? 0.92;
  const ruleSummary = useMemo(() => {
    if (!selectedChild || !selectedDraft) {
      return "";
    }
    const dailyMinutes = Number.parseInt(selectedDraft.daily_limit_minutes, 10);
    const dailyLabel = Number.isFinite(dailyMinutes)
      ? formatDailyLimitSummary(dailyMinutes)
      : `${selectedChild.daily_limit_minutes} min`;
    return `Current rule: ${dailyLabel} daily limit • Bedtime ${formatBedtime12h(selectedDraft.bedtime_start)} to ${formatBedtime12h(selectedDraft.bedtime_end)} • Sound: ${audioRateLabel(selectedAudioRate)}`;
  }, [selectedChild, selectedDraft, selectedAudioRate]);

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
                {selectedChild ? `${selectedChild.name} (Age ${selectedChild.age})` : "Select child"}
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
                Difficulty
              </Text>
              <View style={styles.chipRow}>
                {(["easy", "medium", "hard"] as const).map((tier) => (
                  <Chip
                    key={tier}
                    selected={selectedDraft.difficulty_level === tier}
                    onPress={() =>
                      setDrafts((prev) => ({
                        ...prev,
                        [selectedChild.id]: { ...selectedDraft, difficulty_level: tier },
                      }))
                    }
                    compact
                  >
                    {difficultyTierLabel(tier)}
                  </Chip>
                ))}
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

          <Card style={styles.childCard}>
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
                subtitle="Adjust daily limits and quiet hours with the arrows."
                style={styles.sectionHeaderInCard}
              />
              <StepperControl
                label="Daily Screen Limit"
                value={formatDailyLimitDisplay(selectedDraft.daily_limit_minutes, selectedChild.daily_limit_minutes)}
                onValuePress={() => setDurationPickerOpen(true)}
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
              <StepperControl
                label="Bedtime Start"
                value={formatBedtime12h(selectedDraft.bedtime_start)}
                onValuePress={() => setBedtimePickerField("start")}
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
                onValuePress={() => setBedtimePickerField("end")}
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

      <ParentManageToast
        visible={toast != null}
        message={toast?.message ?? ""}
        variant={toast?.variant ?? "success"}
        onHide={hideToast}
        durationMs={toast?.variant === "error" ? 4500 : 3200}
      />

      <Portal>
        <Dialog visible={childPickerVisible} onDismiss={() => setChildPickerVisible(false)}>
          <Dialog.Title>Select child</Dialog.Title>
          <Dialog.ScrollArea style={styles.pickerDialogScroll}>
            {children.map((child) => (
              <List.Item
                key={child.id}
                title={child.name}
                description={`Age ${child.age}`}
                left={() =>
                  child.avatar_url ? (
                    <Image source={{ uri: child.avatar_url }} style={styles.pickerListAvatar} />
                  ) : (
                    <View style={styles.pickerListAvatarFallback}>
                      <Text style={styles.pickerListAvatarLetter}>{child.name.slice(0, 1).toUpperCase()}</Text>
                    </View>
                  )
                }
                onPress={() => {
                  setSelectedChildId(child.id);
                  setChildPickerVisible(false);
                }}
              />
            ))}
          </Dialog.ScrollArea>
        </Dialog>

        <Dialog visible={showCreateDialog} onDismiss={() => setShowCreateDialog(false)}>
          <Dialog.Title>Create Child Account</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodySmall" style={styles.helper}>
              Parent creates child login + PIN in one step.
            </Text>
            <TextInput label="Child Name" mode="outlined" value={newChildName} onChangeText={setNewChildName} />
            <TextInput
              label="Child Age"
              mode="outlined"
              value={newChildAge}
              keyboardType="number-pad"
              onChangeText={(value) => setNewChildAge(value.replace(/[^0-9]/g, ""))}
            />
            <TextInput
              label="Child Email"
              mode="outlined"
              value={newChildEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setNewChildEmail}
            />
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
              Assign an exercise to {exerciseTarget?.name ?? "child"}.
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
                  {ex.title}
                </Chip>
              ))}
            </View>
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
            <PrimaryButton label={assigning ? "Assigning..." : "Assign"} onPress={() => void assignExercise()} disabled={assigning} />
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={Boolean(learningTarget)} onDismiss={() => setLearningTarget(null)}>
          <Dialog.Title>Assign learning game</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodySmall" style={styles.helper}>
              Choose a mini-game your child must complete to earn rewards.
            </Text>
            <View style={styles.chipRow}>
              {CHILD_GAME_CATALOG.map((g) => (
                <Chip key={g.id} selected={learningGameId === g.id} onPress={() => setLearningGameId(g.id)}>
                  {g.title}
                </Chip>
              ))}
            </View>
            <TextInput
              label="Reward points (stars)"
              mode="outlined"
              value={learningPoints}
              keyboardType="number-pad"
              onChangeText={(v) => setLearningPoints(v.replace(/[^0-9]/g, "").slice(0, 4))}
            />
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
  pickerDialogScroll: {
    maxHeight: 320,
    paddingHorizontal: 8,
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
