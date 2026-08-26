import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { CommonActions } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Text, useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ChildActivitiesStackParamList } from "@/types/navigation";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ConfettiBurst } from "@/components/ConfettiBurst";
import { radii, shadows } from "@/theme/theme";
import { useAppColors } from "@/theme/useAppColors";
import { getExerciseById, normalizeExerciseId } from "@/data/exercises";
import { useExerciseRepDetector } from "@/hooks/useExerciseRepDetector";
import { ExerciseMascotDemo } from "@/components/exercise/ExerciseMascotDemo";
import { ExerciseWorkoutCamera } from "@/components/exercise/ExerciseWorkoutCamera";
import { ExerciseFrameGuide } from "@/components/exercise/ExerciseFrameGuide";
import { ExerciseWorkoutHud } from "@/components/exercise/ExerciseWorkoutHud";
import { ExerciseGoalStar } from "@/components/exercise/ExerciseGoalStar";
import { childTabBarHiddenStyle, childTabBarVisibleStyle } from "@/navigation/childTabBarStyle";
import { isFullBodyExercise } from "@/services/exerciseFrameBounds";
import { supabase } from "@/services/supabase";
import { useChildProfile } from "@/hooks/useChildProfile";
import { Camera as VisionCamera } from "react-native-vision-camera";
import { isStreamPoseAvailable } from "@/services/exercisePoseNative";
import { ParentManageToast } from "@/components/parent/ParentManageToast";
import { formatAppError } from "@/utils/errors";
import { isLikelyOfflineError, OFFLINE_MSG } from "@/services/offlineMessages";
import { useLocale } from "@/store/LocaleContext";
import { localizedExercise } from "@/i18n/helpers";

type Props = NativeStackScreenProps<ChildActivitiesStackParamList, "ExerciseSession">;
type SessionPhase = "demo" | "workout" | "completed";

export function ChildExerciseSessionScreen({ route, navigation }: Props) {
  const c = useAppColors();
  const { t } = useLocale();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(c, insets), [c, insets]);
  const taskId = route.params.taskId;
  const selectedId = normalizeExerciseId(route.params.exerciseId);
  const exercise = useMemo(() => getExerciseById(selectedId), [selectedId]);
  const exerciseTitle = useMemo(() => localizedExercise(selectedId, t).title, [selectedId, t]);
  const isLegWorkout = isFullBodyExercise(selectedId);
  const { child, refresh: refreshProfile } = useChildProfile();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [phase, setPhase] = useState<SessionPhase>("demo");
  const [demoFinished, setDemoFinished] = useState(false);
  const [demoRunId, setDemoRunId] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [startingCamera, setStartingCamera] = useState(false);
  const [targetReps, setTargetReps] = useState(exercise.defaultReps);
  const [points, setPoints] = useState(exercise.defaultPoints);
  const [completed, setCompleted] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [celebrationKey, setCelebrationKey] = useState(0);
  const completedTransitionRef = useRef(false);
  const awardStartedRef = useRef(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
    };
  }, []);

  const exitSession = useCallback(() => {
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
    // Reset stack so ExerciseSession is not left underneath ActivitiesMain
    // (returning to the Activities tab later would reopen a stale workout).
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "ActivitiesMain", params: { segment: "movement", navKey: Date.now() } }],
      }),
    );
    if (taskId) {
      navigation.getParent()?.navigate("Home", {
        screen: "TasksList",
        params: { navKey: Date.now() },
      });
    }
  }, [navigation, taskId]);

  const practiceAgain = useCallback(() => {
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
    completedTransitionRef.current = false;
    awardStartedRef.current = false;
    setCompleted(0);
    setPhase("demo");
    setDemoFinished(false);
    setDemoRunId((n) => n + 1);
    setCameraReady(false);
    setStartingCamera(false);
    setToast(null);
    setError(null);
  }, []);

  const cameraOn = phase === "workout";

  const handleCameraReady = useCallback(() => {
    setCameraReady(true);
  }, []);

  const onRepDetected = useCallback(() => {
    setCompleted((n) => Math.min(targetReps, n + 1));
  }, [targetReps]);

  const {
    isEmulator,
    useLegacyCamera,
    formQuality,
    feedStreamPose,
  } = useExerciseRepDetector({
    enabled: cameraOn && cameraReady,
    exerciseId: selectedId,
    cameraRef,
    onRep: onRepDetected,
  });

  useEffect(() => {
    setTargetReps(exercise.defaultReps);
    setPoints(exercise.defaultPoints);
    setCompleted(0);
  }, [selectedId, exercise.defaultReps, exercise.defaultPoints]);

  // Reset in-session state when a different exercise/task opens on this screen.
  useEffect(() => {
    setPhase("demo");
    setDemoFinished(false);
    setDemoRunId((n) => n + 1);
    setCameraReady(false);
    setStartingCamera(false);
    setCompleted(0);
    setError(null);
    setToast(null);
    completedTransitionRef.current = false;
    awardStartedRef.current = false;
  }, [selectedId, taskId]);

  useEffect(() => {
    async function loadTask() {
      if (!taskId || !supabase || !child) return;
      const { data } = await supabase.from("tasks").select("description, xp_reward").eq("id", taskId).maybeSingle();
      if (!data) return;
      if (typeof data.xp_reward === "number") setPoints(data.xp_reward);
      if (data.description) {
        try {
          const parsed = JSON.parse(data.description);
          const reps = Number(parsed?.targetReps);
          if (!Number.isNaN(reps) && reps > 0) setTargetReps(reps);
        } catch {
          // ignore
        }
      }
    }
    void loadTask();
  }, [taskId, child]);

  const remaining = Math.max(0, targetReps - completed);
  const done = remaining === 0;

  const awardStars = useCallback(async () => {
    if (!supabase || !child || !done) return;
    setError(null);
    setIsSaving(true);

    if (taskId) {
      const { error: updateError } = await supabase
        .from("tasks")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", taskId);
      if (updateError) {
        setIsSaving(false);
        setError(
          isLikelyOfflineError(updateError) ? OFFLINE_MSG.award : formatAppError(updateError),
        );
        return;
      }
    }

    const { error: awardError } = await supabase.rpc("award_child_points", {
      p_child_id: child.id,
      p_points: points,
      p_event_type: taskId ? "exercise_completed" : "exercise_practice",
      p_metadata: {
        task_id: taskId,
        exercise_id: selectedId,
        target_reps: targetReps,
        completed_reps: completed,
      },
    });

    setIsSaving(false);
    if (awardError) {
      setError(isLikelyOfflineError(awardError) ? OFFLINE_MSG.award : formatAppError(awardError));
      return;
    }

    await refreshProfile(true);
    if (!mountedRef.current) return;
    setToast(`You earned ${points} stars!`);
    // Practice: stay on complete screen (Practice again / Back).
    // Assigned task: return to tasks after a short celebration.
    if (taskId) {
      exitTimerRef.current = setTimeout(() => {
        if (mountedRef.current) exitSession();
      }, 3200);
    }
  }, [child, completed, done, exitSession, points, refreshProfile, selectedId, targetReps, taskId]);

  useEffect(() => {
    if (!done || phase !== "workout" || completedTransitionRef.current) return;
    completedTransitionRef.current = true;
    const timer = setTimeout(() => {
      setCameraReady(false);
      setPhase("completed");
      setCelebrationKey((key) => key + 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [done, phase]);

  useEffect(() => {
    if (phase !== "completed" || awardStartedRef.current) return;
    awardStartedRef.current = true;
    const timer = setTimeout(() => {
      void awardStars();
    }, 2000);
    return () => clearTimeout(timer);
  }, [awardStars, phase]);

  useEffect(() => {
    const parent = navigation.getParent();
    if (!parent) return;
    // Hide tabs for the whole session (demo + workout + completed).
    parent.setOptions({ tabBarStyle: childTabBarHiddenStyle });
    return () => {
      parent.setOptions({ tabBarStyle: childTabBarVisibleStyle(theme.colors.surface) });
    };
  }, [navigation, theme.colors.surface]);

  const stopWorkout = useCallback(() => {
    completedTransitionRef.current = false;
    awardStartedRef.current = false;
    setCompleted(0);
    setPhase("demo");
    setDemoFinished(true);
    setCameraReady(false);
    setStartingCamera(false);
    setError(null);
  }, []);

  // Hardware / gesture back during workout → return to demo (fresh session next start).
  useEffect(() => {
    const unsub = navigation.addListener("beforeRemove", (e) => {
      if (phase !== "workout") return;
      e.preventDefault();
      stopWorkout();
    });
    return unsub;
  }, [navigation, phase, stopWorkout]);

  const startDemo = () => {
    setError(null);
    setDemoFinished(false);
    setDemoRunId((n) => n + 1);
    setCompleted(0);
    setPhase("demo");
  };

  const beginWorkout = async () => {
    setError(null);
    setStartingCamera(true);
    try {
      if (!permission?.granted) {
        const res = await requestPermission();
        if (!res.granted) {
          setError(t("child.exercise.cameraPermissionRequired"));
          return;
        }
      }
      if (isStreamPoseAvailable()) {
        const visionStatus = await VisionCamera.getCameraPermissionStatus();
        if (visionStatus !== "granted") {
          const visionRes = await VisionCamera.requestCameraPermission();
          if (visionRes !== "granted") {
            setError(t("child.exercise.cameraPermissionRequired"));
            return;
          }
        }
      }
      setCompleted(0);
      setCameraReady(false);
      completedTransitionRef.current = false;
      awardStartedRef.current = false;
      setPhase("workout");
    } finally {
      setStartingCamera(false);
    }
  };

  if (!permission) {
    return (
      <View style={[styles.centered, { backgroundColor: c.background }]}>
        <Text style={{ color: c.text }}>{t("child.exercise.loadingCamera")}</Text>
      </View>
    );
  }

  if (phase === "completed") {
    return (
      <View style={[styles.workoutRoot, { backgroundColor: c.background }]}>
        <ConfettiBurst triggerKey={celebrationKey} />
        <View style={[styles.completedCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <MaterialCommunityIcons name="check-circle" size={88} color={c.primary} />
          <Text variant="headlineSmall" style={{ color: c.primaryDark, fontWeight: "900", textAlign: "center" }}>
            {t("child.exercise.workoutComplete")}
          </Text>
          <Text variant="titleMedium" style={{ color: c.text, fontWeight: "700", textAlign: "center" }}>
            {exercise.emoji} {exerciseTitle}
          </Text>
          <Text variant="bodyLarge" style={{ color: c.subtext, textAlign: "center" }}>
            {t("child.exercise.repsDone", { completed, target: targetReps })}
          </Text>
          {isSaving ? (
            <Text style={{ color: c.primary, fontWeight: "700" }}>{t("child.exercise.awarding")}</Text>
          ) : (
            <Text style={{ color: c.subtext }}>{t("child.exercise.greatJob")}</Text>
          )}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <PrimaryButton label={t("child.exercise.practiceAgain")} onPress={practiceAgain} />
          <PrimaryButton label={t("child.exercise.backToActivities")} mode="outlined" onPress={exitSession} />
        </View>
        <ParentManageToast
          visible={toast != null}
          message={toast ?? ""}
          variant="success"
          onHide={() => setToast(null)}
          durationMs={3000}
        />
      </View>
    );
  }

  if (phase === "workout") {
    const cameraBlock = (
      <View style={[styles.cameraArea, isLegWorkout && styles.cameraAreaFull]}>
        {permission.granted ? (
          <ExerciseWorkoutCamera
            enabled={cameraOn}
            useLegacyCamera={useLegacyCamera}
            legacyCameraRef={cameraRef}
            onStreamPose={feedStreamPose}
            onCameraReady={handleCameraReady}
          />
        ) : null}

        {!cameraReady ? (
          <View style={styles.cameraOverlay}>
            <Text style={styles.overlayText}>{t("child.exercise.openingCamera")}</Text>
          </View>
        ) : null}

        {cameraReady ? (
          <ExerciseFrameGuide
            quality={formQuality}
            exerciseId={selectedId}
          />
        ) : null}

        <View style={styles.workoutTopBar}>
          <Pressable
            onPress={stopWorkout}
            style={styles.workoutBack}
            accessibilityRole="button"
            accessibilityLabel={t("child.exercise.stopWorkout")}
          >
            <MaterialCommunityIcons name="chevron-left" size={28} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.workoutTitle}>
            {exercise.emoji} {exerciseTitle}
          </Text>
          <View style={styles.workoutTopSpacer} />
        </View>

        {cameraReady && isLegWorkout ? (
          <View style={[styles.hudWrap, { top: insets.top + 52, paddingHorizontal: 12 }]}>
            <ExerciseWorkoutHud
              remaining={remaining}
              completed={completed}
              targetReps={targetReps}
            />
          </View>
        ) : null}
      </View>
    );

    if (isLegWorkout) {
      return (
        <View style={[styles.workoutRoot, styles.workoutRootFull, { backgroundColor: "#000000" }]}>
          {cameraBlock}
          {error ? (
            <View style={styles.workoutErrorFloat}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </View>
      );
    }

    return (
      <View style={[styles.workoutRoot, { backgroundColor: "#000000" }]}>
        {cameraBlock}

        <View style={[styles.workoutBottom, { backgroundColor: c.card }]}>
          <View style={styles.repRowCompact}>
            <View style={[styles.repBigBox, { backgroundColor: c.primary }]}>
              <Text style={styles.repBigLabel}>{t("child.exercise.remaining")}</Text>
              <Text style={styles.repBigNum}>{String(remaining).padStart(2, "0")}</Text>
            </View>
            <View style={styles.repSideCompact}>
              <Text style={{ color: c.subtext, fontSize: 12, fontWeight: "700" }}>
                {completed}/{targetReps}
              </Text>
              <View style={styles.bottomProgressRow}>
                <View style={styles.bottomProgressTrack}>
                  <View
                    style={[
                      styles.bottomProgressFill,
                      {
                        width: `${targetReps > 0 ? Math.round(Math.min(1, completed / targetReps) * 100) : 0}%`,
                        backgroundColor: c.primary,
                      },
                    ]}
                  />
                </View>
                <ExerciseGoalStar reached={completed >= targetReps} size="md" />
              </View>
            </View>
          </View>

          {done && !isSaving ? (
            <Text style={{ color: c.primary, fontWeight: "800", textAlign: "center", fontSize: 15 }}>
              {t("child.exercise.allRepsDone")}
            </Text>
          ) : null}

          {isEmulator && __DEV__ ? (
            <PrimaryButton
              label={t("child.exercise.testRep")}
              mode="outlined"
              onPress={() => setCompleted((n) => Math.min(targetReps, n + 1))}
            />
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      </View>
    );
  }

  if (phase === "demo") {
    return (
      <ScrollView style={[styles.flex, { backgroundColor: c.background }]} contentContainerStyle={styles.sessionContent}>
        <View style={styles.sessionTopRow}>
          <Pressable onPress={exitSession} style={styles.sessionBack} accessibilityRole="button">
            <MaterialCommunityIcons name="chevron-left" size={26} color={c.primaryDark} />
          </Pressable>
          <Text variant="titleMedium" style={{ color: c.primaryDark, fontWeight: "800", flex: 1 }}>
            {exercise.emoji} {exerciseTitle}
          </Text>
        </View>

        <View style={[styles.exerciseSummary, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text variant="bodySmall" style={{ color: c.subtext }}>
            {taskId
              ? t("child.exercise.assignedTask", { reps: targetReps })
              : t("child.exercise.practiceGoal", { reps: targetReps })}
          </Text>
          {!taskId ? (
            <View style={styles.stepperRow}>
              <Pressable
                style={[styles.stepBtn, { backgroundColor: c.primary }]}
                onPress={() => setTargetReps((n) => Math.max(1, n - 1))}
              >
                <Text style={styles.stepBtnText}>−</Text>
              </Pressable>
              <Text style={[styles.stepValue, { color: c.text }]}>{targetReps} {t("common.reps")}</Text>
              <Pressable
                style={[styles.stepBtn, { backgroundColor: c.primary }]}
                onPress={() => setTargetReps((n) => Math.min(50, n + 1))}
              >
                <Text style={styles.stepBtnText}>+</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {!demoFinished ? (
          <ExerciseMascotDemo
            key={`${selectedId}-${demoRunId}`}
            exerciseId={selectedId}
            exerciseTitle={exerciseTitle}
            onComplete={() => setDemoFinished(true)}
          />
        ) : (
          <View style={[styles.controlCard, { backgroundColor: c.card }]}>
            <Text variant="bodyMedium" style={{ color: c.text, textAlign: "center", fontWeight: "700" }}>
              {t("child.exercise.niceYourTurn")}
            </Text>
            <Text variant="bodySmall" style={{ color: c.subtext, textAlign: "center" }}>
              {t("child.exercise.standInFrame")}
            </Text>
          </View>
        )}

        <View style={[styles.controlCard, { backgroundColor: c.card }]}>
          <PrimaryButton
            label={startingCamera ? t("child.exercise.starting") : t("child.exercise.yourTurnOpenCamera")}
            onPress={() => void beginWorkout()}
            disabled={startingCamera}
            labelStyle={{ fontWeight: "800", letterSpacing: 1.2 }}
          />
          <PrimaryButton label={t("child.exercise.watchAgain")} mode="outlined" onPress={startDemo} />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      </ScrollView>
    );
  }

  return null;
}

function createStyles(c: ReturnType<typeof useAppColors>, insets: { top: number; bottom: number }) {
  return StyleSheet.create({
    flex: { flex: 1 },
    centered: { flex: 1, alignItems: "center", justifyContent: "center" },
    sessionContent: { padding: 16, paddingBottom: 48, gap: 12, flexGrow: 1 },
    sessionTopRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    sessionBack: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    exerciseSummary: {
      borderRadius: radii.md,
      borderWidth: 1,
      padding: 12,
      gap: 4,
      ...shadows.card,
    },
    emulatorBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 10,
      borderRadius: radii.md,
      borderWidth: 1,
    },
    colorLegend: {
      padding: 12,
      borderRadius: radii.md,
      borderWidth: 1,
    },
    controlCard: { borderRadius: radii.lg, padding: 16, gap: 12, ...shadows.card },
    stepperRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 8 },
    stepBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    stepBtnText: { color: "#FFFFFF", fontSize: 20, fontWeight: "700" },
    stepValue: { fontSize: 16, fontWeight: "800", minWidth: 72, textAlign: "center" },
    btnRow: { flexDirection: "row", gap: 10 },
    flexBtn: { flex: 1 },
    errorText: { color: c.danger, textAlign: "center" },
    workoutRoot: { flex: 1 },
    workoutRootFull: { paddingBottom: 0 },
    cameraArea: { flex: 1, position: "relative" },
    cameraAreaFull: { flex: 1 },
    hudWrap: {
      position: "absolute",
      left: 0,
      right: 0,
    },
    workoutErrorFloat: {
      position: "absolute",
      left: 16,
      right: 16,
      bottom: 24,
      backgroundColor: "rgba(255,255,255,0.95)",
      borderRadius: radii.md,
      padding: 12,
    },
    cameraOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center",
      justifyContent: "center",
    },
    overlayText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
    scanDim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.12)",
    },
    scanShield: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(12, 22, 16, 0.88)",
      alignItems: "center",
      justifyContent: "center",
    },
    scanShieldText: {
      color: "#C5E84D",
      fontWeight: "800",
      fontSize: 16,
    },
    workoutTopBar: {
      position: "absolute",
      top: insets.top + 8,
      left: 12,
      right: 12,
      flexDirection: "row",
      alignItems: "center",
    },
    workoutBack: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "rgba(0,0,0,0.45)",
      alignItems: "center",
      justifyContent: "center",
    },
    workoutTitle: { flex: 1, textAlign: "center", color: "#FFFFFF", fontWeight: "800", fontSize: 17 },
    workoutTopSpacer: { width: 40 },
    badgeWrap: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 12,
    },
    workoutBottom: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: Math.max(insets.bottom, 12),
      gap: 10,
      borderTopLeftRadius: radii.lg,
      borderTopRightRadius: radii.lg,
      ...shadows.card,
    },
    repRowCompact: { flexDirection: "row", gap: 10, alignItems: "center" },
    repBigBox: {
      width: 88,
      borderRadius: radii.md,
      paddingVertical: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    repBigLabel: { color: "rgba(255,255,255,0.9)", fontWeight: "600", fontSize: 12 },
    repBigNum: { color: "#FFFFFF", fontSize: 32, fontWeight: "900" },
    repSideCompact: { flex: 1, gap: 6 },
    bottomProgressRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    bottomProgressTrack: {
      flex: 1,
      height: 10,
      borderRadius: 999,
      backgroundColor: c.progressTrack,
      overflow: "hidden",
    },
    bottomProgressFill: {
      height: "100%",
      borderRadius: 999,
    },
    completedCard: {
      flex: 1,
      margin: 20,
      marginTop: 48,
      borderRadius: radii.lg,
      borderWidth: 1,
      padding: 28,
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
      ...shadows.card,
    },
  });
}
