import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { createClient } from "@supabase/supabase-js";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ActivityIndicator, Card, Chip, Divider, Snackbar, Text, TextInput } from "react-native-paper";
import { ScreenContainer } from "@/components/ScreenContainer";
import { PrimaryButton } from "@/components/PrimaryButton";
import { colors } from "@/theme/theme";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/store/AuthContext";
import { formatAppError } from "@/utils/errors";
import { radii, shadows } from "@/theme/theme";
import { env } from "@/config/env";

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
};

type SortMode = "recent" | "name" | "age" | "stars";

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
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [newChildName, setNewChildName] = useState("");
  const [newChildAge, setNewChildAge] = useState("");
  const [newChildEmail, setNewChildEmail] = useState("");
  const [searchText, setSearchText] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [sortAscending, setSortAscending] = useState(true);

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
      .select("id, child_user_id, login_email, login_secret, auth_pin, name, age, stars, daily_limit_minutes, difficulty_level, bedtime_start, bedtime_end")
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
  const filteredChildren = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    const base = query
      ? children.filter((child) => child.name.toLowerCase().includes(query))
      : [...children];

    const sorted = [...base].sort((a, b) => {
      if (sortMode === "name") {
        return a.name.localeCompare(b.name);
      }
      if (sortMode === "age") {
        return a.age - b.age;
      }
      if (sortMode === "stars") {
        return a.stars - b.stars;
      }
      return a.name.localeCompare(b.name);
    });

    if (sortMode === "recent") {
      return sortAscending ? base : base.reverse();
    }

    return sortAscending ? sorted : sorted.reverse();
  }, [children, searchText, sortMode, sortAscending]);

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

  const generatePin = () => String(Math.floor(100000 + Math.random() * 900000));

  const createChildAccount = async () => {
    if (!supabase) {
      return;
    }
    setError(null);

    if (!newChildName.trim() || !newChildAge.trim() || !newChildEmail.trim()) {
      setError("Name, age, and child email are required.");
      return;
    }

    const age = Number(newChildAge);
    if (Number.isNaN(age) || age <= 0 || age >= 18) {
      setError("Child age must be between 1 and 17.");
      return;
    }
    const {
      data: { user: parentUser },
      error: parentUserError,
    } = await supabase.auth.getUser();

    if (parentUserError || !parentUser) {
      setError(formatAppError(parentUserError ?? new Error("Parent session not found.")));
      return;
    }

    setIsCreating(true);
    const pin = generatePin();
    const loginSecret = `LG-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
    if (!env.supabaseUrl || !env.supabaseAnonKey) {
      setIsCreating(false);
      setError("Supabase is not configured.");
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
      setError(formatAppError(signUpError ?? new Error("Failed to create child login account.")));
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
      setError(formatAppError(insertError));
      return;
    }

    setNewChildName("");
    setNewChildAge("");
    setNewChildEmail("");
    setSnackbar(`Child account created. PIN: ${pin}`);
    await loadChildren(false);
  };

  const regeneratePin = async (childId: string) => {
    if (!supabase) {
      return;
    }
    setError(null);
    const pin = generatePin();
    const { error: pinError } = await supabase.from("children").update({ auth_pin: pin }).eq("id", childId);
    if (pinError) {
      setError(formatAppError(pinError));
      return;
    }
    setSnackbar(`PIN regenerated: ${pin}`);
    await loadChildren(false);
  };

  const onRefresh = useCallback(() => {
    void loadChildren(true);
  }, [loadChildren]);

  return (
    <ScreenContainer scroll onRefresh={onRefresh} refreshing={refreshing}>
      <Text variant="titleMedium" style={styles.kicker}>
        Create child login accounts, share their PIN, and edit limits.
      </Text>

      <Card style={styles.controlsCard}>
        <Card.Content style={styles.controlsContent}>
          <TextInput
            label="Search child by name"
            mode="outlined"
            value={searchText}
            onChangeText={setSearchText}
            autoCapitalize="words"
            left={<TextInput.Icon icon="magnify" />}
          />
          <View style={styles.sortHeader}>
            <Text variant="labelLarge" style={styles.sectionLabel}>
              Sort children
            </Text>
            <Chip icon={sortAscending ? "sort-ascending" : "sort-descending"} onPress={() => setSortAscending((prev) => !prev)}>
              {sortAscending ? "Ascending" : "Descending"}
            </Chip>
          </View>
          <View style={styles.chipRow}>
            <Chip selected={sortMode === "recent"} onPress={() => setSortMode("recent")}>
              Recent
            </Chip>
            <Chip selected={sortMode === "name"} onPress={() => setSortMode("name")}>
              Name
            </Chip>
            <Chip selected={sortMode === "age"} onPress={() => setSortMode("age")}>
              Age
            </Chip>
            <Chip selected={sortMode === "stars"} onPress={() => setSortMode("stars")}>
              Stars
            </Chip>
          </View>
        </Card.Content>
      </Card>

      {isLoading && !refreshing ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {isEmpty ? <Text>No children found for this parent account yet.</Text> : null}
      {!isEmpty && filteredChildren.length === 0 ? (
        <Text style={styles.emptyFiltered}>No child matched "{searchText}".</Text>
      ) : null}

      <Card style={styles.childCard}>
        <Card.Title title="Create Child Account" subtitle="Parent creates child login + PIN in one step." />
        <Card.Content style={styles.cardContent}>
          <Text variant="bodySmall" style={styles.helper}>
            Use a unique child name so login by name + PIN is easy and accurate.
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
          <PrimaryButton label={isCreating ? "Creating..." : "Create Child Account"} onPress={() => void createChildAccount()} disabled={isCreating} />
        </Card.Content>
      </Card>

      {filteredChildren.map((child) => {
        const draft = drafts[child.id] ?? child;
        return (
          <Card key={child.id} style={styles.childCard}>
            <Card.Title title={child.name} subtitle={`Age ${child.age} - ${child.stars} stars`} />
            <Card.Content style={styles.cardContent}>
              <View style={styles.pinRow}>
                <View style={styles.pinLeft}>
                  <MaterialCommunityIcons name="numeric-6-box-multiple-outline" size={18} color={colors.primaryDark} />
                  <Text variant="titleSmall" style={styles.pinLabel}>
                    PIN: {child.auth_pin}
                  </Text>
                </View>
                <PrimaryButton label="Regenerate PIN" mode="text" onPress={() => void regeneratePin(child.id)} />
              </View>
              <Text variant="bodySmall" style={styles.pinHint}>
                Child signs in using name + this PIN in Child Access.
              </Text>
              <Divider />
              <Text variant="labelLarge" style={styles.sectionLabel}>
                Learning & Screen Controls
              </Text>
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
  controlsCard: {
    borderRadius: radii.md,
    ...shadows.card,
  },
  controlsContent: {
    gap: 10,
  },
  sortHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  cardContent: {
    gap: 10,
  },
  helper: {
    color: colors.subtext,
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
    color: colors.primaryDark,
    fontWeight: "700",
  },
  pinHint: {
    color: colors.subtext,
  },
  sectionLabel: {
    color: colors.text,
    fontWeight: "700",
  },
  emptyFiltered: {
    color: colors.subtext,
  },
  errorText: {
    color: "#B91C1C",
  },
});
