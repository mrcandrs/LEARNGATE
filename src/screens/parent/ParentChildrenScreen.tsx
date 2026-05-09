import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { createClient } from "@supabase/supabase-js";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ActivityIndicator, Card, Chip, Dialog, Divider, Menu, Portal, Snackbar, Text, TextInput } from "react-native-paper";
import { ScreenContainer } from "@/components/ScreenContainer";
import { PrimaryButton } from "@/components/PrimaryButton";
import { colors } from "@/theme/theme";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/store/AuthContext";
import { formatAppError } from "@/utils/errors";
import { radii, shadows } from "@/theme/theme";
import { env } from "@/config/env";
import { EXERCISES, type ExerciseId } from "@/data/exercises";
import { CHILD_GAME_CATALOG } from "@/data/childGames";
import type { GameId } from "@/data/childGames";
import { difficultyTierLabel, difficultyTierToLevel, levelToDifficultyTier, type DifficultyTier } from "@/utils/difficulty";

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
  difficulty_level: DifficultyTier;
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
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [pinBusyChildId, setPinBusyChildId] = useState<string | null>(null);
  const [saveBusyChildId, setSaveBusyChildId] = useState<string | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [childMenuVisible, setChildMenuVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [newChildName, setNewChildName] = useState("");
  const [newChildAge, setNewChildAge] = useState("");
  const [newChildEmail, setNewChildEmail] = useState("");
  const [searchText, setSearchText] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [sortAscending, setSortAscending] = useState(true);
  const [exerciseTarget, setExerciseTarget] = useState<ChildRow | null>(null);
  const [exerciseId, setExerciseId] = useState<ExerciseId>("jumping");
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
        difficulty_level: levelToDifficultyTier(row.difficulty_level),
        bedtime_start: row.bedtime_start,
        bedtime_end: row.bedtime_end,
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
    if (!draft.daily_limit_minutes.trim()) {
      setError("Daily limit is required.");
      return;
    }

    const dailyLimit = Number(draft.daily_limit_minutes);
    const difficulty = difficultyTierToLevel(draft.difficulty_level);
    if (Number.isNaN(dailyLimit)) {
      setError("Please enter a valid daily limit.");
      return;
    }

    setSaveBusyChildId(childId);
    const { error: updateError } = await supabase
      .from("children")
      .update({
        daily_limit_minutes: dailyLimit,
        difficulty_level: difficulty,
        bedtime_start: draft.bedtime_start,
        bedtime_end: draft.bedtime_end,
      })
      .eq("id", childId);
    setSaveBusyChildId((prev) => (prev === childId ? null : prev));

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
    setShowCreateDialog(false);
    setSnackbar(`Child account created. PIN: ${pin}`);
    await loadChildren(false);
  };

  const regeneratePin = async (childId: string) => {
    if (!supabase) {
      return;
    }
    setError(null);
    const pin = generatePin();
    setPinBusyChildId(childId);
    const { error: pinError } = await supabase.from("children").update({ auth_pin: pin }).eq("id", childId);
    setPinBusyChildId((prev) => (prev === childId ? null : prev));
    if (pinError) {
      setError(formatAppError(pinError));
      return;
    }
    setSnackbar(`PIN regenerated: ${pin}`);
    await loadChildren(false);
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
    setError(null);

    const reps = Number(exerciseReps);
    const pts = Number(exercisePoints);
    if (Number.isNaN(reps) || reps <= 0 || reps > 999) {
      setError("Exercise reps must be a valid number.");
      return;
    }
    if (Number.isNaN(pts) || pts < 0 || pts > 9999) {
      setError("Exercise points must be a valid number.");
      return;
    }

    const {
      data: { user },
      error: uError,
    } = await supabase.auth.getUser();
    if (uError || !user) {
      setError(formatAppError(uError ?? new Error("Not signed in.")));
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
      setError(formatAppError(insError));
      return;
    }

    setExerciseTarget(null);
    setSnackbar(`Exercise assigned: ${def.title} (${reps} reps)`);
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
    setError(null);
    const pts = Number(learningPoints);
    if (Number.isNaN(pts) || pts < 0 || pts > 9999) {
      setError("Learning points must be a valid number.");
      return;
    }
    const {
      data: { user },
      error: uError,
    } = await supabase.auth.getUser();
    if (uError || !user) {
      setError(formatAppError(uError ?? new Error("Not signed in.")));
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
      setError(formatAppError(insError));
      return;
    }
    setLearningTarget(null);
    setSnackbar(`Learning task assigned: ${game.title}`);
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
    setError(null);
    if (!choreTitle.trim()) {
      setError("Chore title is required.");
      return;
    }
    const pts = Number(chorePoints);
    if (Number.isNaN(pts) || pts < 0 || pts > 9999) {
      setError("Chore points must be a valid number.");
      return;
    }
    const {
      data: { user },
      error: uError,
    } = await supabase.auth.getUser();
    if (uError || !user) {
      setError(formatAppError(uError ?? new Error("Not signed in.")));
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
      setError(formatAppError(insError));
      return;
    }
    setChoreTarget(null);
    setSnackbar(`Chore assigned: ${choreTitle.trim()}`);
  };

  const onRefresh = useCallback(() => {
    void loadChildren(true);
  }, [loadChildren]);

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
          bedtime_start: selectedChild.bedtime_start,
          bedtime_end: selectedChild.bedtime_end,
        };
  }, [drafts, selectedChild]);

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
      {children.length > 0 ? (
        <Card style={styles.childCard}>
          <Card.Title title="Selected Child" subtitle="Select one child to view PIN and controls." />
          <Card.Content style={styles.cardContent}>
            <Menu
              visible={childMenuVisible}
              onDismiss={() => setChildMenuVisible(false)}
              anchor={
                <Pressable
                  onPress={() => setChildMenuVisible(true)}
                  style={styles.pickerRow}
                  accessibilityRole="button"
                  accessibilityLabel="Select child"
                >
                  <View style={styles.pickerLeft}>
                    <MaterialCommunityIcons name="account-child-outline" size={20} color={colors.primaryDark} />
                    <View style={styles.pickerTextWrap}>
                      <Text variant="labelMedium" style={styles.pickerLabel}>
                        Child
                      </Text>
                      <Text variant="titleSmall" style={styles.pickerValue}>
                        {selectedChild ? `${selectedChild.name} (Age ${selectedChild.age})` : "Select child"}
                      </Text>
                    </View>
                  </View>
                  <MaterialCommunityIcons name="chevron-down" size={22} color={colors.subtext} />
                </Pressable>
              }
            >
              {filteredChildren.map((child) => (
                <Menu.Item
                  key={child.id}
                  title={child.name}
                  onPress={() => {
                    setSelectedChildId(child.id);
                    setChildMenuVisible(false);
                  }}
                />
              ))}
            </Menu>

            {selectedChild && selectedDraft ? (
              <>
                <Divider />
                <View style={styles.pinRow}>
                  <View style={styles.pinLeft}>
                    <MaterialCommunityIcons name="numeric-6-box-multiple-outline" size={18} color={colors.primaryDark} />
                    <Text variant="titleSmall" style={styles.pinLabel}>
                      PIN: {selectedChild.auth_pin}
                    </Text>
                  </View>
                  <View style={styles.inlineBusyWrap}>
                    {pinBusyChildId === selectedChild.id ? <ActivityIndicator size="small" color={colors.primary} /> : null}
                    <PrimaryButton
                      label={pinBusyChildId === selectedChild.id ? "Updating..." : "Regenerate PIN"}
                      mode="text"
                      onPress={() => void regeneratePin(selectedChild.id)}
                      disabled={pinBusyChildId === selectedChild.id}
                    />
                  </View>
                </View>
                <Text variant="bodySmall" style={styles.pinHint}>
                  Child signs in using name + this PIN in Child Access.
                </Text>
                <Divider />
                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeaderRow}>
                    <MaterialCommunityIcons name="tune-variant" size={18} color={colors.primaryDark} />
                    <Text variant="labelLarge" style={styles.sectionLabel}>
                      Learning & Screen Controls
                    </Text>
                  </View>
                  <Text variant="bodySmall" style={styles.helper}>
                    Assign activities and adjust limits for this child.
                  </Text>

                  <View style={styles.subSection}>
                    <Text variant="labelLarge" style={styles.subSectionTitle}>
                      Assign tasks
                    </Text>
                    <View style={styles.assignRow}>
                      <PrimaryButton label="Learning Game" mode="outlined" onPress={() => openAssignLearning(selectedChild)} />
                      <PrimaryButton label="Household Chore" mode="outlined" onPress={() => openAssignChore(selectedChild)} />
                      <PrimaryButton label="Exercise" mode="outlined" onPress={() => openAssignExercise(selectedChild)} />
                    </View>
                  </View>

                  <Divider />
                  <View style={styles.subSection}>
                    <Text variant="labelLarge" style={styles.subSectionTitle}>
                      Limits
                    </Text>
                    <View style={styles.twoColRow}>
                      <View style={styles.twoColItem}>
                        <TextInput
                          label="Daily limit (min)"
                          mode="outlined"
                          value={selectedDraft.daily_limit_minutes}
                          keyboardType="number-pad"
                          onChangeText={(value) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [selectedChild.id]: { ...selectedDraft, daily_limit_minutes: value.replace(/[^0-9]/g, "") },
                            }))
                          }
                        />
                      </View>
                      <View style={styles.twoColItem}>
                        <Text variant="labelLarge" style={styles.sectionLabel}>
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
                      </View>
                    </View>
                  </View>

                  <Divider />
                  <View style={styles.subSection}>
                    <Text variant="labelLarge" style={styles.subSectionTitle}>
                      Bedtime
                    </Text>
                    <View style={styles.twoColRow}>
                      <View style={styles.twoColItem}>
                        <TextInput
                          label="Start (HH:mm)"
                          mode="outlined"
                          value={selectedDraft.bedtime_start}
                          onChangeText={(value) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [selectedChild.id]: { ...selectedDraft, bedtime_start: value },
                            }))
                          }
                        />
                      </View>
                      <View style={styles.twoColItem}>
                        <TextInput
                          label="End (HH:mm)"
                          mode="outlined"
                          value={selectedDraft.bedtime_end}
                          onChangeText={(value) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [selectedChild.id]: { ...selectedDraft, bedtime_end: value },
                            }))
                          }
                        />
                      </View>
                    </View>
                  </View>
                </View>
                <View style={styles.saveRow}>
                  {saveBusyChildId === selectedChild.id ? <ActivityIndicator size="small" color={colors.primary} /> : null}
                  <PrimaryButton
                    label={saveBusyChildId === selectedChild.id ? "Saving..." : "Save Changes"}
                    onPress={() => void saveChild(selectedChild.id)}
                    disabled={saveBusyChildId === selectedChild.id}
                  />
                </View>
              </>
            ) : null}
          </Card.Content>
        </Card>
      ) : null}
      <Snackbar visible={Boolean(snackbar)} onDismiss={() => setSnackbar(null)} duration={1800}>
        {snackbar ?? ""}
      </Snackbar>

      <PrimaryButton label="Create Child Account" onPress={() => setShowCreateDialog(true)} />

      <Portal>
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
      </Portal>
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
  assignRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  cardContent: {
    gap: 10,
  },
  pickerRow: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
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
    color: colors.subtext,
  },
  pickerValue: {
    color: colors.text,
    fontWeight: "700",
  },
  inlineBusyWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  saveRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 6,
  },
  sectionCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.text,
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
