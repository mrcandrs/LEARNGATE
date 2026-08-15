import { useCallback, useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { ActivityIndicator, Card, Dialog, Portal, Snackbar, Text, TextInput } from "react-native-paper";
import { ScreenContainer } from "@/components/ScreenContainer";
import { PrimaryButton } from "@/components/PrimaryButton";
import { colors, radii, shadows } from "@/theme/theme";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/store/AuthContext";
import { getEvidenceSignedUrl } from "@/services/taskEvidence";
import { formatAppError } from "@/utils/errors";
import { useLocale } from "@/store/LocaleContext";

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
  const { t } = useLocale();
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<SubmissionRow | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const loadSubmissions = useCallback(async (fromPull = false) => {
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
    const { data, error: qError } = await supabase
      .from("task_submissions")
      .select(
        "id, created_at, image_url, task_id, child_id, tasks(title, xp_reward), children(name)"
      )
      .eq("status", "submitted")
      .order("created_at", { ascending: false });

    if (qError) {
      setError(formatAppError(qError));
      setIsLoading(false);
      setRefreshing(false);
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
    setRefreshing(false);
  }, [isSupabaseConfigured]);

  useEffect(() => {
    void loadSubmissions(false);
  }, [loadSubmissions]);

  const onRefresh = useCallback(() => {
    void loadSubmissions(true);
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
      setError(formatAppError(userError ?? new Error("Not signed in.")));
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
      setError(formatAppError(subErr));
      setBusyId(null);
      return;
    }

    const { error: taskErr } = await supabase
      .from("tasks")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", row.task_id);

    if (taskErr) {
      setError(formatAppError(taskErr));
      setBusyId(null);
      return;
    }

    const { error: awardError } = await supabase.rpc("award_child_points", {
      p_child_id: row.child_id,
      p_points: xp,
      p_event_type: "task_completed",
      p_metadata: { task_id: row.task_id, submission_id: row.id, source: "chore_approved" },
    });
    if (awardError) {
      setError(formatAppError(awardError));
      setBusyId(null);
      return;
    }

    setSnackbar(t("parent.submissions.approvedMsg"));
    setBusyId(null);
    await loadSubmissions(false);
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
      setError(formatAppError(userError ?? new Error("Not signed in.")));
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
      setError(formatAppError(subErr));
      setBusyId(null);
      return;
    }

    const { error: taskErr } = await supabase.from("tasks").update({ status: "pending" }).eq("id", target.task_id);
    if (taskErr) {
      setError(formatAppError(taskErr));
      setBusyId(null);
      return;
    }

    const { error: rejectLogError } = await supabase.rpc("award_child_points", {
      p_child_id: target.child_id,
      p_points: 0,
      p_event_type: "task_rejected",
      p_metadata: { task_id: target.task_id, submission_id: target.id, note: rejectNote.trim() || null },
    });
    if (rejectLogError) {
      setError(formatAppError(rejectLogError));
      setBusyId(null);
      return;
    }

    setRejectTarget(null);
    setRejectNote("");
    setSnackbar(t("parent.submissions.rejectedMsg"));
    setBusyId(null);
    await loadSubmissions(false);
  };

  return (
    <ScreenContainer scroll onRefresh={onRefresh} refreshing={refreshing}>
      <Text variant="titleMedium" style={styles.kicker}>
        {t("parent.submissions.title")}
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        {t("parent.submissions.subtitle")}
      </Text>

      {isLoading && !refreshing ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {rows.length === 0 && !isLoading ? (
        <Text style={styles.emptyText}>{t("parent.submissions.empty")}</Text>
      ) : null}

      <View style={styles.list}>
        {rows.map((row) => (
          <Card key={row.id} style={styles.card}>
            <Card.Title title={row.tasks?.title ?? t("parent.submissions.task")} subtitle={row.children?.name ?? t("parent.submissions.child")} />
            <Card.Content style={styles.cardBody}>
              {row.image_url && imageUrls[row.id] ? (
                <Image source={{ uri: imageUrls[row.id] }} style={styles.image} resizeMode="cover" />
              ) : (
                <Text variant="bodySmall">{t("parent.submissions.couldNotLoadImage")}</Text>
              )}
              <Text variant="bodySmall" style={styles.meta}>
                {t("parent.submissions.submittedAt", { date: new Date(row.created_at).toLocaleString() })}
              </Text>
              <View style={styles.rowActions}>
                <PrimaryButton
                  label={t("parent.submissions.approve")}
                  onPress={() => void approve(row)}
                  disabled={busyId === row.id}
                />
                <PrimaryButton
                  label={t("parent.submissions.reject")}
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

      <Portal>
        <Dialog visible={Boolean(rejectTarget)} onDismiss={() => setRejectTarget(null)}>
          <Dialog.Title>{t("parent.submissions.rejectTitle")}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{t("parent.submissions.rejectNoteLabel")}</Text>
            <TextInput mode="outlined" value={rejectNote} onChangeText={setRejectNote} multiline />
          </Dialog.Content>
          <Dialog.Actions>
            <PrimaryButton label={t("parent.submissions.cancel")} onPress={() => setRejectTarget(null)} mode="text" />
            <PrimaryButton label={t("parent.submissions.confirmReject")} onPress={() => void confirmReject()} />
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
  kicker: {
    color: colors.subtext,
    marginBottom: 4,
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
    borderRadius: radii.md,
    ...shadows.card,
  },
  emptyText: {
    color: colors.subtext,
    lineHeight: 20,
  },
  cardBody: {
    gap: 8,
  },
  image: {
    width: "100%",
    height: 200,
    borderRadius: radii.sm,
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
