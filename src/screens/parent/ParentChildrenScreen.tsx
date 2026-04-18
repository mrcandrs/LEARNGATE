import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet } from "react-native";
import { ActivityIndicator, Card, Divider, Snackbar, Text, TextInput } from "react-native-paper";
import { ScreenContainer } from "@/components/ScreenContainer";
import { PrimaryButton } from "@/components/PrimaryButton";
import { colors } from "@/theme/theme";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/store/AuthContext";
import { formatAppError } from "@/utils/errors";
import { radii, shadows } from "@/theme/theme";

type ChildRow = {
  id: string;
  name: string;
  age: number;
  stars: number;
  daily_limit_minutes: number;
  difficulty_level: number;
  bedtime_start: string;
  bedtime_end: string;
};

type ChildDraft = {
  daily_limit_minutes: string;
  difficulty_level: string;
  bedtime_start: string;
  bedtime_end: string;
};

export function ParentChildrenScreen() {
  const { isSupabaseConfigured } = useAuth();
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ChildDraft>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const loadChildren = useCallback(async (fromPull = false) => {
    if (!isSupabaseConfigured || !supabase) {
      setChildren([]);
      setDrafts({});
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

    const { data, error: childrenError } = await supabase
      .from("children")
      .select("id, name, age, stars, daily_limit_minutes, difficulty_level, bedtime_start, bedtime_end")
      .eq("parent_id", user.id)
      .order("created_at", { ascending: true });

    if (childrenError) {
      setError(formatAppError(childrenError));
      setIsLoading(false);
      setRefreshing(false);
      return;
    }

    const rows = (data as ChildRow[]) ?? [];
    const nextDrafts = rows.reduce<Record<string, ChildDraft>>((acc, row) => {
      acc[row.id] = {
        daily_limit_minutes: String(row.daily_limit_minutes),
        difficulty_level: String(row.difficulty_level),
        bedtime_start: row.bedtime_start,
        bedtime_end: row.bedtime_end,
      };
      return acc;
    }, {});
    setChildren(rows);
    setDrafts(nextDrafts);
    setIsLoading(false);
    setRefreshing(false);
  }, [isSupabaseConfigured]);

  useEffect(() => {
    void loadChildren(false);
  }, [loadChildren]);

  const isEmpty = useMemo(() => !isLoading && children.length === 0, [children.length, isLoading]);

  const saveChild = async (childId: string) => {
    if (!supabase || !drafts[childId]) {
      return;
    }
    setError(null);
    const draft = drafts[childId];
    if (!draft.daily_limit_minutes.trim() || !draft.difficulty_level.trim()) {
      setError("Daily limit and difficulty are required.");
      return;
    }

    const dailyLimit = Number(draft.daily_limit_minutes);
    const difficulty = Number(draft.difficulty_level);
    if (Number.isNaN(dailyLimit) || Number.isNaN(difficulty)) {
      setError("Please enter valid numeric values.");
      return;
    }

    const { error: updateError } = await supabase
      .from("children")
      .update({
        daily_limit_minutes: dailyLimit,
        difficulty_level: difficulty,
        bedtime_start: draft.bedtime_start,
        bedtime_end: draft.bedtime_end,
      })
      .eq("id", childId);

    if (updateError) {
      setError(formatAppError(updateError));
      return;
    }
    setSnackbar("Child settings saved successfully.");
    await loadChildren(false);
  };

  const onRefresh = useCallback(() => {
    void loadChildren(true);
  }, [loadChildren]);

  return (
    <ScreenContainer scroll onRefresh={onRefresh} refreshing={refreshing}>
      <Text variant="titleMedium" style={styles.kicker}>
        Edit limits, difficulty, and bedtime for each child.
      </Text>

      {isLoading && !refreshing ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {isEmpty ? <Text>No children found for this parent account yet.</Text> : null}

      {children.map((child) => {
        const draft = drafts[child.id] ?? child;
        return (
          <Card key={child.id} style={styles.childCard}>
            <Card.Title title={child.name} subtitle={`Age ${child.age} - ${child.stars} stars`} />
            <Card.Content style={styles.cardContent}>
              <TextInput
                label="Daily Screen Limit (minutes)"
                mode="outlined"
                value={draft.daily_limit_minutes}
                keyboardType="number-pad"
                onChangeText={(value) =>
                  setDrafts((prev) => ({
                    ...prev,
                    [child.id]: { ...draft, daily_limit_minutes: value.replace(/[^0-9]/g, "") },
                  }))
                }
              />
              <Divider />
              <TextInput
                label="Learning Difficulty (1-10)"
                mode="outlined"
                value={draft.difficulty_level}
                keyboardType="number-pad"
                onChangeText={(value) =>
                  setDrafts((prev) => ({
                    ...prev,
                    [child.id]: { ...draft, difficulty_level: value.replace(/[^0-9]/g, "") },
                  }))
                }
              />
              <Divider />
              <TextInput
                label="Bedtime Start (HH:mm)"
                mode="outlined"
                value={draft.bedtime_start}
                onChangeText={(value) =>
                  setDrafts((prev) => ({
                    ...prev,
                    [child.id]: { ...draft, bedtime_start: value },
                  }))
                }
              />
              <TextInput
                label="Bedtime End (HH:mm)"
                mode="outlined"
                value={draft.bedtime_end}
                onChangeText={(value) =>
                  setDrafts((prev) => ({
                    ...prev,
                    [child.id]: { ...draft, bedtime_end: value },
                  }))
                }
              />
              <PrimaryButton label="Save Changes" onPress={() => void saveChild(child.id)} />
            </Card.Content>
          </Card>
        );
      })}
      <Snackbar visible={Boolean(snackbar)} onDismiss={() => setSnackbar(null)} duration={1800}>
        {snackbar ?? ""}
      </Snackbar>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  kicker: {
    color: colors.subtext,
    marginBottom: 8,
  },
  childCard: {
    borderRadius: radii.md,
    ...shadows.card,
  },
  cardContent: {
    gap: 10,
  },
  errorText: {
    color: "#B91C1C",
  },
});
