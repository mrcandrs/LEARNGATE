import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet } from "react-native";
import { ActivityIndicator, Card, Text } from "react-native-paper";
import { ScreenContainer } from "@/components/ScreenContainer";
import { PrimaryButton } from "@/components/PrimaryButton";
import { colors } from "@/theme/theme";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/store/AuthContext";

type ChildProfile = {
  id: string;
  name: string;
  age: number;
  difficulty_level: number;
  stars: number;
};

export function ChildProfileScreen() {
  const { isSupabaseConfigured, signOut } = useAuth();
  const [profile, setProfile] = useState<ChildProfile | null>(null);
  const [completedTasks, setCompletedTasks] = useState(0);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      setError("Unable to resolve child session.");
      setIsLoading(false);
      return;
    }

    const { data: child, error: childError } = await supabase
      .from("children")
      .select("id, name, age, difficulty_level, stars")
      .eq("child_user_id", user.id)
      .maybeSingle();

    if (childError || !child) {
      setError("No child profile linked to this account.");
      setIsLoading(false);
      return;
    }
    setProfile(child as ChildProfile);

    const { count, error: tasksCountError } = await supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("child_id", child.id)
      .eq("status", "completed");
    if (tasksCountError) {
      setError(tasksCountError.message);
      setIsLoading(false);
      return;
    }
    setCompletedTasks(count ?? 0);

    // Placeholder metric until a games history table is introduced.
    const { count: activityCount } = await supabase
      .from("activity_logs")
      .select("id", { count: "exact", head: true })
      .eq("child_id", child.id)
      .eq("type", "game_played");
    setGamesPlayed(activityCount ?? 0);
    setIsLoading(false);
  }, [isSupabaseConfigured]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const achievements = useMemo(() => {
    const badges: string[] = [];
    if ((profile?.stars ?? 0) > 0) {
      badges.push("First Star");
    }
    if ((profile?.stars ?? 0) >= 200) {
      badges.push("Star Collector");
    }
    if (completedTasks >= 10) {
      badges.push("Task Finisher");
    }
    if (completedTasks >= 50) {
      badges.push("Learning Champ");
    }
    return badges;
  }, [completedTasks, profile?.stars]);

  return (
    <ScreenContainer scroll>
      {isLoading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Text variant="headlineMedium" style={styles.title}>
        {profile?.name ?? "Child Profile"}
      </Text>
      <Text variant="bodyLarge" style={styles.subtitle}>
        Age {profile?.age ?? "-"} - Level {profile?.difficulty_level ?? "-"}
      </Text>

      <Card>
        <Card.Title title="Learning Stats" />
        <Card.Content style={styles.statsList}>
          <Text>Total Learning Time: --</Text>
          <Text>Tasks Completed: {completedTasks}</Text>
          <Text>Games Played: {gamesPlayed}</Text>
          <Text>Stars Earned: {profile?.stars ?? 0}</Text>
        </Card.Content>
      </Card>

      <Card>
        <Card.Title title="Achievements" />
        <Card.Content style={styles.statsList}>
          {achievements.length === 0 ? <Text>No achievements yet.</Text> : achievements.map((badge) => <Text key={badge}>{badge}</Text>)}
        </Card.Content>
      </Card>

      <PrimaryButton label="Sign Out" onPress={() => void signOut()} mode="outlined" />
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
  statsList: {
    gap: 10,
  },
  errorText: {
    color: "#B91C1C",
  },
});
