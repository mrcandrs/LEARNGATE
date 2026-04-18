import { useCallback, useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { ActivityIndicator, Card, Dialog, Portal, Snackbar, Text, TextInput } from "react-native-paper";
import { ScreenContainer } from "@/components/ScreenContainer";
import { PrimaryButton } from "@/components/PrimaryButton";
import { colors } from "@/theme/theme";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/store/AuthContext";
import { getEvidenceSignedUrl } from "@/services/taskEvidence";

type SubmissionRow = {
  id: string;
  created_at: string;
  image_url: string | null;
  task_id: string;
  child_id: string;
  tasks: { title: string; xp_reward: number } | null;
  children: { name: string } | null;
};

function normalizeJoined<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function ParentSubmissionsScreen() {
  const { isSupabaseConfigured } = useAuth();
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<SubmissionRow | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const loadSubmissions = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    const { data, error: qError } = await supabase
      .from("task_submissions")
      .select(
        "id, created_at, image_url, task_id, child_id, tasks(title, xp_reward), children(name)"
      )
      .eq("status", "submitted")
      .order("created_at", { ascending: false });

    if (qError) {
      setError(qError.message);
      setIsLoading(false);
      return;
    }

    const rawList = (data ?? []) as Array<
      Omit<SubmissionRow, "tasks" | "children"> & {
        tasks: SubmissionRow["tasks"] | SubmissionRow["tasks"][];
        children: SubmissionRow["children"] | SubmissionRow["children"][];
      }
    >;

    const list: SubmissionRow[] = rawList.map((row) => ({
      ...row,
      tasks: normalizeJoined(row.tasks),
      children: normalizeJoined(row.children),
    }));
    setRows(list);

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
    setImageUrls(urlMap);
    setIsLoading(false);
  }, [isSupabaseConfigured]);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

  const approve = async (row: SubmissionRow) => {
    if (!supabase) {
      return;
    }
    setBusyId(row.id);
    setError(null);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      setError("Not signed in.");
      setBusyId(null);
      return;
    }

    const xp = row.tasks?.xp_reward ?? 0;

    const { error: subErr } = await supabase
      .from("task_submissions")
      .update({
        status: "approved",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (subErr) {
      setError(subErr.message);
      setBusyId(null);
      return;
    }

    const { error: taskErr } = await supabase
      .from("tasks")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", row.task_id);

    if (taskErr) {
      setError(taskErr.message);
      setBusyId(null);
      return;
    }

    const { data: childRow } = await supabase.from("children").select("stars").eq("id", row.child_id).maybeSingle();
    const currentStars = childRow?.stars ?? 0;
    const { error: starErr } = await supabase
      .from("children")
      .update({ stars: currentStars + xp })
      .eq("id", row.child_id);

    if (starErr) {
      setError(starErr.message);
      setBusyId(null);
      return;
    }

    await supabase.from("activity_logs").insert({
      child_id: row.child_id,
      actor_profile_id: user.id,
      type: "task_completed",
      points: xp,
      metadata: { task_id: row.task_id, submission_id: row.id, source: "chore_approved" },
    });

    setSnackbar("Submission approved.");
    setBusyId(null);
    await loadSubmissions();
  };

  const confirmReject = async () => {
    if (!supabase || !rejectTarget) {
      return;
    }
    setBusyId(rejectTarget.id);
    setError(null);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      setError("Not signed in.");
      setBusyId(null);
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
      setError(subErr.message);
      setBusyId(null);
      return;
    }

    const { error: taskErr } = await supabase.from("tasks").update({ status: "pending" }).eq("id", target.task_id);
    if (taskErr) {
      setError(taskErr.message);
      setBusyId(null);
      return;
    }

    await supabase.from("activity_logs").insert({
      child_id: target.child_id,
      actor_profile_id: user.id,
      type: "task_rejected",
      points: 0,
      metadata: { task_id: target.task_id, submission_id: target.id, note: rejectNote.trim() || null },
    });

    setRejectTarget(null);
    setRejectNote("");
    setSnackbar("Submission rejected. Child can try again.");
    setBusyId(null);
    await loadSubmissions();
  };

  return (
    <ScreenContainer scroll>
      <Text variant="headlineMedium" style={styles.title}>
        Chore Reviews
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Approve or reject photo evidence submitted by your child.
      </Text>

      {isLoading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {rows.length === 0 && !isLoading ? <Text>No submissions waiting for review.</Text> : null}

      <View style={styles.list}>
        {rows.map((row) => (
          <Card key={row.id} style={styles.card}>
            <Card.Title title={row.tasks?.title ?? "Task"} subtitle={row.children?.name ?? "Child"} />
            <Card.Content style={styles.cardBody}>
              {row.image_url && imageUrls[row.id] ? (
                <Image source={{ uri: imageUrls[row.id] }} style={styles.image} resizeMode="cover" />
              ) : (
                <Text variant="bodySmall">Could not load image.</Text>
              )}
              <Text variant="bodySmall" style={styles.meta}>
                Submitted {new Date(row.created_at).toLocaleString()}
              </Text>
              <View style={styles.rowActions}>
                <PrimaryButton
                  label="Approve"
                  onPress={() => void approve(row)}
                  disabled={busyId === row.id}
                />
                <PrimaryButton
                  label="Reject"
                  onPress={() => {
                    setRejectTarget(row);
                    setRejectNote("");
                  }}
                  mode="outlined"
                  disabled={busyId === row.id}
                />
              </View>
            </Card.Content>
          </Card>
        ))}
      </View>

      <PrimaryButton label="Refresh" onPress={() => void loadSubmissions()} mode="text" />

      <Portal>
        <Dialog visible={Boolean(rejectTarget)} onDismiss={() => setRejectTarget(null)}>
          <Dialog.Title>Reject submission</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">Optional note for your child:</Text>
            <TextInput mode="outlined" value={rejectNote} onChangeText={setRejectNote} multiline />
          </Dialog.Content>
          <Dialog.Actions>
            <PrimaryButton label="Cancel" onPress={() => setRejectTarget(null)} mode="text" />
            <PrimaryButton label="Confirm reject" onPress={() => void confirmReject()} />
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={Boolean(snackbar)} onDismiss={() => setSnackbar(null)} duration={2000}>
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
  subtitle: {
    color: colors.subtext,
    marginBottom: 8,
  },
  list: {
    gap: 0,
  },
  card: {
    marginBottom: 12,
  },
  cardBody: {
    gap: 8,
  },
  image: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  meta: {
    color: colors.subtext,
  },
  rowActions: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
    flexWrap: "wrap",
  },
  errorText: {
    color: "#B91C1C",
  },
});
