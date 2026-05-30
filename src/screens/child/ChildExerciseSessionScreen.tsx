import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Card, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ChildTasksStackParamList } from "@/types/navigation";
import { ScreenContainer } from "@/components/ScreenContainer";
import { PrimaryButton } from "@/components/PrimaryButton";
import { radii, shadows } from "@/theme/theme";
import { useAppColors } from "@/theme/useAppColors";
import { getExerciseById } from "@/data/exercises";
import { supabase } from "@/services/supabase";
import { useChildProfile } from "@/hooks/useChildProfile";
import { formatAppError } from "@/utils/errors";

type Props = NativeStackScreenProps<ChildTasksStackParamList, "ExerciseSession">;

export function ChildExerciseSessionScreen({ route, navigation }: Props) {
  const c = useAppColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const { taskId, exerciseId } = route.params;
  const exercise = useMemo(() => getExerciseById(exerciseId), [exerciseId]);
  const { child, refresh: refreshProfile } = useChildProfile();
  const [permission, requestPermission] = useCameraPermissions();
  const [introDismissed, setIntroDismissed] = useState(false);
  const [targetReps, setTargetReps] = useState(exercise.defaultReps);
  const [points, setPoints] = useState(exercise.defaultPoints);
  const [completed, setCompleted] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTask() {
      if (!supabase || !child) {
        return;
      }
      const { data, error: tError } = await supabase.from("tasks").select("description, xp_reward").eq("id", taskId).maybeSingle();
      if (tError || !data) {
        return;
      }
      if (typeof data.xp_reward === "number") {
        setPoints(data.xp_reward);
      }
      if (data.description) {
        try {
          const parsed = JSON.parse(data.description);
          const reps = Number(parsed?.targetReps);
          if (!Number.isNaN(reps) && reps > 0) {
            setTargetReps(reps);
          }
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
    if (permission?.granted) {
      return true;
    }
    const res = await requestPermission();
    return Boolean(res.granted);
  };

  const saveAndFinish = async () => {
    if (!supabase || !child) {
      return;
    }
    setError(null);
    setIsSaving(true);

    const { error: updateError } = await supabase
      .from("tasks")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", taskId);

    if (updateError) {
      setIsSaving(false);
      setError(formatAppError(updateError));
      return;
    }

    const { error: awardError } = await supabase.rpc("award_child_points", {
      p_child_id: child.id,
      p_points: points,
      p_event_type: "exercise_completed",
      p_metadata: { task_id: taskId, exercise_id: exerciseId, target_reps: targetReps, completed_reps: completed },
    });

    setIsSaving(false);
    if (awardError) {
      setError(formatAppError(awardError));
      return;
    }

    await refreshProfile(true);
    navigation.goBack();
  };

  if (!permission) {
    return (
      <ScreenContainer>
        <Text>Loading camera permission…</Text>
      </ScreenContainer>
    );
  }

  if (!permission.granted) {
    return (
      <ScreenContainer>
        <Card style={[styles.permissionCard, shadows.card]}>
          <Card.Content style={styles.permissionInner}>
            <MaterialCommunityIcons name="camera-outline" size={40} color={c.primaryDark} />
            <Text variant="titleLarge" style={styles.permissionTitle}>
              Allow access to the camera and let&apos;s go!
            </Text>
            <Text variant="bodyMedium" style={styles.permissionSub}>
              We do not store or record data.
            </Text>
            <PrimaryButton label="Allow Camera" onPress={() => void requestPermission()} />
            <PrimaryButton label="Back" mode="text" onPress={() => navigation.goBack()} />
          </Card.Content>
        </Card>
      </ScreenContainer>
    );
  }

  if (!introDismissed) {
    return (
      <ScreenContainer scroll>
        <Card style={[styles.introCard, shadows.card]}>
          <Card.Content style={styles.introInner}>
            <Text variant="headlineSmall" style={styles.introTitle}>
              {exercise.title}
            </Text>
            <Text style={styles.introHint}>{exercise.instruction}</Text>
            <View style={styles.counterDemo}>
              <Text variant="headlineMedium" style={styles.counterNum}>
                {String(targetReps).padStart(2, "0")}
              </Text>
              <View style={styles.counterBar} />
            </View>
            <Text variant="bodyMedium" style={styles.introSub}>
              Check out the video to see how it works
            </Text>
            <Text variant="bodySmall" style={styles.introNote}>
              We do not store or record data
            </Text>
            <PrimaryButton
              label="OK, got it"
              onPress={async () => {
                const ok = await ensurePermission();
                if (ok) {
                  setIntroDismissed(true);
                }
              }}
            />
          </Card.Content>
        </Card>
      </ScreenContainer>
    );
  }

  return (
    <View style={styles.full}>
      <CameraView style={styles.camera} facing="front" />

      <View style={[styles.overlayFrame, { borderColor: done ? "#22C55E" : "#EF4444" }]} />

      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="chevron-left" size={26} color="#FFFFFF" />
        </Pressable>
        <View style={styles.topPill}>
          <Text style={styles.topPillText}>{exercise.title}</Text>
        </View>
      </View>

      <View style={styles.bottomSheet}>
        <View style={styles.repBox}>
          <Text variant="headlineSmall" style={styles.repBig}>
            {String(remaining).padStart(2, "0")}
          </Text>
          <View style={styles.repText}>
            <Text variant="titleMedium" style={styles.repTitle}>
              Remaining
            </Text>
            <Text variant="bodySmall" style={styles.repSub}>
              Completed: {completed}
            </Text>
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.actions}>
          <PrimaryButton
            label="+1 rep"
            onPress={() => setCompleted((c) => Math.min(targetReps, c + 1))}
            disabled={done || isSaving}
          />
          <PrimaryButton
            label="Undo"
            mode="outlined"
            onPress={() => setCompleted((c) => Math.max(0, c - 1))}
            disabled={completed === 0 || isSaving}
          />
          <PrimaryButton
            label={isSaving ? "Saving..." : `Finish (+${points})`}
            onPress={() => void saveAndFinish()}
            disabled={!done || isSaving}
          />
        </View>

        <Text style={styles.smallNote}>Tip: Stand inside the frame and do the exercise. Tap +1 after each rep.</Text>
      </View>
    </View>
  );
}

const createStyles = (c: ReturnType<typeof useAppColors>) =>
  StyleSheet.create({
  full: { flex: 1, backgroundColor: "#000000" },
  camera: { flex: 1 },
  topBar: {
    position: "absolute",
    top: 44,
    left: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  topPill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  topPillText: { color: "#FFFFFF", fontWeight: "700" },
  overlayFrame: {
    position: "absolute",
    top: 120,
    left: 30,
    right: 30,
    bottom: 210,
    borderRadius: 22,
    borderWidth: 4,
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  bottomSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 14,
    backgroundColor: c.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    gap: 10,
    ...shadows.card,
  },
  repBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  repBig: {
    width: 64,
    textAlign: "center",
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: c.surfaceTint,
    color: c.primaryDark,
    fontWeight: "900",
  },
  repText: { flex: 1 },
  repTitle: { fontWeight: "800", color: c.text },
  repSub: { color: c.subtext },
  actions: { gap: 8 },
  smallNote: { color: c.subtext, textAlign: "center" },
  errorText: { color: "#B91C1C", textAlign: "center" },
  permissionCard: { borderRadius: radii.lg, backgroundColor: c.card },
  permissionInner: { gap: 10, alignItems: "center" },
  permissionTitle: { fontWeight: "800", textAlign: "center", color: c.text },
  permissionSub: { color: c.subtext, textAlign: "center", marginBottom: 6 },
  introCard: { borderRadius: radii.lg, backgroundColor: c.card },
  introInner: { gap: 10, alignItems: "center" },
  introTitle: { fontWeight: "800", color: c.text },
  introHint: { color: c.subtext, textAlign: "center" },
  introSub: { fontWeight: "800", color: c.text, textAlign: "center" },
  introNote: { color: c.subtext, textAlign: "center" },
  counterDemo: {
    width: "100%",
    borderRadius: radii.md,
    backgroundColor: c.mutedSurface,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  counterNum: {
    width: 56,
    textAlign: "center",
    backgroundColor: c.card,
    borderRadius: 12,
    paddingVertical: 10,
    fontWeight: "900",
    color: c.primaryDark,
  },
  counterBar: { flex: 1, height: 10, borderRadius: 6, backgroundColor: c.progressTrack },
});

