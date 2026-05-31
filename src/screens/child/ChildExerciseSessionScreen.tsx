import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { CameraView, useCameraPermissions } from "expo-camera";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Menu, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ChildActivitiesStackParamList } from "@/types/navigation";
import { PrimaryButton } from "@/components/PrimaryButton";
import { radii, shadows } from "@/theme/theme";
import { useAppColors } from "@/theme/useAppColors";
import { EXERCISES, getExerciseById, normalizeExerciseId, type ExerciseId } from "@/data/exercises";
import { useExerciseRepDetector } from "@/hooks/useExerciseRepDetector";
import { supabase } from "@/services/supabase";
import { useChildProfile } from "@/hooks/useChildProfile";
import { formatAppError } from "@/utils/errors";

type Props = NativeStackScreenProps<ChildActivitiesStackParamList, "ExerciseSession">;

const LEARNGATE_LOGO = require("../../../assets/icon.png");

export function ChildExerciseSessionScreen({ route, navigation }: Props) {
  const c = useAppColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const taskId = route.params.taskId;
  const initialId = normalizeExerciseId(route.params.exerciseId);
  const [selectedId, setSelectedId] = useState<ExerciseId>(initialId);
  const exercise = useMemo(() => getExerciseById(selectedId), [selectedId]);
  const { child, refresh: refreshProfile } = useChildProfile();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [phase, setPhase] = useState<"intro" | "session">("intro");
  const [cameraOn, setCameraOn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [targetReps, setTargetReps] = useState(exercise.defaultReps);
  const [points, setPoints] = useState(exercise.defaultPoints);
  const [completed, setCompleted] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onRepDetected = useCallback(() => {
    setCompleted((n) => Math.min(targetReps, n + 1));
  }, [targetReps]);

  const { moveStatus } = useExerciseRepDetector({
    enabled: cameraOn && phase === "session",
    exerciseId: selectedId,
    cameraRef,
    onRep: onRepDetected,
  });

  useEffect(() => {
    setTargetReps(exercise.defaultReps);
    setPoints(exercise.defaultPoints);
    setCompleted(0);
  }, [selectedId, exercise.defaultReps, exercise.defaultPoints]);

  useEffect(() => {
    async function loadTask() {
      if (!taskId || !supabase || !child) return;
      const { data } = await supabase.from("tasks").select("description, xp_reward").eq("id", taskId).maybeSingle();
      if (!data) return;
      if (typeof data.xp_reward === "number") setPoints(data.xp_reward);
      if (data.description) {
        try {
          const parsed = JSON.parse(data.description);
          if (parsed?.exerciseId) setSelectedId(normalizeExerciseId(parsed.exerciseId));
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

  const ensurePermission = async () => {
    if (permission?.granted) return true;
    const res = await requestPermission();
    return Boolean(res.granted);
  };

  const startCamera = async () => {
    const ok = await ensurePermission();
    if (ok) {
      setCameraOn(true);
      setError(null);
    } else {
      setError("Camera permission is required.");
    }
  };

  const saveAndFinish = async () => {
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
        setError(formatAppError(updateError));
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
      setError(formatAppError(awardError));
      return;
    }
    await refreshProfile(true);
    navigation.goBack();
  };

  const moveLabel =
    moveStatus === "Rep!"
      ? "Rep!"
      : moveStatus === "Move!"
        ? "Move!"
        : moveStatus === "Watching"
          ? cameraOn
            ? "Watching"
            : "Stopped"
          : "Stopped";

  if (!permission) {
    return (
      <View style={[styles.centered, { backgroundColor: c.background }]}>
        <Text style={{ color: c.text }}>Loading camera…</Text>
      </View>
    );
  }

  if (phase === "intro") {
    return (
      <View style={[styles.flex, { backgroundColor: c.background }]}>
        <LinearGradient
          colors={[...c.heroGradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.introHeader}
        >
          <Pressable onPress={() => navigation.goBack()} style={styles.backCircle}>
            <MaterialCommunityIcons name="chevron-left" size={28} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.introBrand}>LearnGate</Text>
          <Image source={LEARNGATE_LOGO} style={styles.introLogo} accessibilityLabel="LearnGate" />
          <Text variant="headlineMedium" style={styles.introTitle}>
            Exercise Time!
          </Text>
          <Text style={styles.introSub}>Pick an exercise. Let the camera see your full body.</Text>
        </LinearGradient>
        <ScrollView
          style={styles.introScroll}
          contentContainerStyle={styles.introBody}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.cameraPlaceholder, { borderColor: c.primary, backgroundColor: c.surfaceTint }]}>
            <MaterialCommunityIcons name="camera-off" size={48} color={c.primary} />
            <Text style={[styles.cameraOffTitle, { color: c.primaryDark }]}>Camera is off</Text>
            <Text style={{ color: c.subtext }}>Tap Start below when you are ready</Text>
          </View>
          <Text style={[styles.bodyHint, { color: c.primaryDark }]}>Keep your whole body inside the camera.</Text>
          <PrimaryButton label="Start" onPress={() => setPhase("session")} />
        </ScrollView>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.flex, { backgroundColor: c.background }]} contentContainerStyle={styles.sessionContent}>
      <Text style={[styles.bodyHint, { color: c.primaryDark }]}>Keep your whole body inside the camera.</Text>

      <View style={[styles.cameraFrame, { borderColor: c.primary }]}>
        {cameraOn && permission.granted ? (
          <CameraView ref={cameraRef} style={styles.camera} facing="front" />
        ) : (
          <View style={[styles.cameraInner, { backgroundColor: c.surfaceTint }]}>
            <MaterialCommunityIcons name="camera-off" size={40} color={c.primary} />
            <Text style={{ color: c.subtext, marginTop: 8 }}>Camera is off</Text>
          </View>
        )}
      </View>

      <View style={styles.repRow}>
        <View style={[styles.repBigBox, { backgroundColor: c.primary }]}>
          <Text style={styles.repBigLabel}>Remaining</Text>
          <Text style={styles.repBigNum}>{String(remaining).padStart(2, "0")}</Text>
          <Text style={styles.repBigLabel}>reps</Text>
        </View>
        <View style={styles.repSide}>
          <View style={[styles.repSmallBox, { borderColor: c.border, backgroundColor: c.card }]}>
            <Text style={{ color: c.subtext }}>Done</Text>
            <Text style={[styles.repSmallVal, { color: c.text }]}>{completed}</Text>
          </View>
          <View style={[styles.repSmallBox, { borderColor: c.border, backgroundColor: c.card }]}>
            <Text style={{ color: c.subtext }}>Move</Text>
            <Text style={[styles.repSmallVal, { color: moveStatus === "Rep!" ? c.primary : c.text }]}>{moveLabel}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.controlCard, { backgroundColor: c.card }]}>
        <Text style={[styles.controlLabel, { color: c.primaryDark }]}>Choose exercise</Text>
        <Menu
          visible={menuOpen}
          onDismiss={() => setMenuOpen(false)}
          anchor={
            <Pressable
              style={[styles.picker, { borderColor: c.border }]}
              onPress={() => !cameraOn && setMenuOpen(true)}
              disabled={cameraOn}
            >
              <Text style={{ color: c.text }}>
                {exercise.emoji} {exercise.title}
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={22} color={c.subtext} />
            </Pressable>
          }
        >
          {EXERCISES.map((ex) => (
            <Menu.Item
              key={ex.id}
              onPress={() => {
                setSelectedId(ex.id);
                setMenuOpen(false);
              }}
              title={`${ex.emoji} ${ex.title}`}
            />
          ))}
        </Menu>

        <Text variant="bodySmall" style={{ color: c.subtext }}>
          {exercise.instruction}
        </Text>

        {!taskId ? (
          <>
            <Text style={[styles.controlLabel, { color: c.primaryDark }]}>Target reps</Text>
            <View style={styles.stepperRow}>
              <Pressable
                style={[styles.stepBtn, { backgroundColor: c.primary }]}
                onPress={() => setTargetReps((n) => Math.max(1, n - 1))}
                disabled={cameraOn}
              >
                <Text style={styles.stepBtnText}>−</Text>
              </Pressable>
              <Text style={[styles.stepValue, { color: c.text }]}>{targetReps}</Text>
              <Pressable
                style={[styles.stepBtn, { backgroundColor: c.primary }]}
                onPress={() => setTargetReps((n) => Math.min(50, n + 1))}
                disabled={cameraOn}
              >
                <Text style={styles.stepBtnText}>+</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Text style={{ color: c.text, fontWeight: "700" }}>Goal: {targetReps} reps</Text>
        )}

        <View style={styles.btnRow}>
          <View style={styles.flexBtn}>
            <PrimaryButton label="Start Camera" onPress={() => void startCamera()} disabled={cameraOn} />
          </View>
          <View style={styles.flexBtn}>
            <PrimaryButton
              label="Reset"
              mode="outlined"
              onPress={() => {
                setCompleted(0);
                setCameraOn(false);
              }}
            />
          </View>
        </View>

        {cameraOn ? (
          <PrimaryButton label="Stop Camera" mode="outlined" onPress={() => setCameraOn(false)} />
        ) : null}

        <PrimaryButton
          label={isSaving ? "Saving…" : done ? `Finish (+${points})` : `Complete ${targetReps} reps to finish`}
          onPress={() => void saveAndFinish()}
          disabled={!done || isSaving}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.statusRow}>
          <Text style={[styles.statusPill, { backgroundColor: c.mutedSurface, color: c.subtext }]}>
            Camera: {cameraOn ? "on" : "stopped"}
          </Text>
          <Text style={[styles.statusPill, { backgroundColor: c.mutedSurface, color: c.subtext }]}>
            Detection: {cameraOn ? "active" : "off"}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

function createStyles(c: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    flex: { flex: 1 },
    centered: { flex: 1, alignItems: "center", justifyContent: "center" },
    introHeader: {
      paddingTop: 48,
      paddingBottom: 28,
      paddingHorizontal: 20,
      alignItems: "center",
      borderBottomLeftRadius: radii.lg,
      borderBottomRightRadius: radii.lg,
    },
    backCircle: {
      position: "absolute",
      left: 16,
      top: 48,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "rgba(255,255,255,0.25)",
      alignItems: "center",
      justifyContent: "center",
    },
    introBrand: { color: "rgba(255,255,255,0.9)", fontWeight: "700", marginBottom: 8 },
    introLogo: { width: 88, height: 88, borderRadius: 20 },
    introTitle: { color: "#FFFFFF", fontWeight: "800", textAlign: "center", marginTop: 8 },
    introSub: { color: "rgba(255,255,255,0.92)", textAlign: "center", marginTop: 8 },
    introScroll: { flex: 1 },
    introBody: { flexGrow: 1, padding: 16, paddingBottom: 32, gap: 14 },
    cameraPlaceholder: {
      flex: 1,
      minHeight: 280,
      borderRadius: radii.lg,
      borderWidth: 3,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    cameraOffTitle: { fontWeight: "800", fontSize: 18 },
    bodyHint: { fontWeight: "800", textAlign: "center", marginVertical: 8 },
    sessionContent: { padding: 16, paddingBottom: 48, gap: 12, flexGrow: 1 },
    cameraFrame: {
      height: 220,
      borderRadius: radii.lg,
      borderWidth: 3,
      overflow: "hidden",
      ...shadows.card,
    },
    camera: { flex: 1 },
    cameraInner: { flex: 1, alignItems: "center", justifyContent: "center" },
    repRow: { flexDirection: "row", gap: 10 },
    repBigBox: {
      flex: 1,
      borderRadius: radii.md,
      padding: 14,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 120,
    },
    repBigLabel: { color: "rgba(255,255,255,0.9)", fontWeight: "600" },
    repBigNum: { color: "#FFFFFF", fontSize: 36, fontWeight: "900" },
    repSide: { flex: 1, gap: 10 },
    repSmallBox: {
      flex: 1,
      borderRadius: radii.md,
      borderWidth: 1,
      padding: 12,
      justifyContent: "center",
      ...shadows.card,
    },
    repSmallVal: { fontSize: 22, fontWeight: "800", marginTop: 4 },
    controlCard: { borderRadius: radii.lg, padding: 16, gap: 12, ...shadows.card },
    controlLabel: { fontWeight: "700" },
    picker: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderRadius: radii.md,
      padding: 12,
    },
    stepperRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16 },
    stepBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
    stepBtnText: { color: "#FFFFFF", fontSize: 22, fontWeight: "700" },
    stepValue: { fontSize: 22, fontWeight: "800", minWidth: 40, textAlign: "center" },
    btnRow: { flexDirection: "row", gap: 10 },
    flexBtn: { flex: 1 },
    statusRow: { flexDirection: "row", justifyContent: "center", gap: 8, flexWrap: "wrap" },
    statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill, fontSize: 12 },
    errorText: { color: "#B91C1C", textAlign: "center" },
  });
}
