import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Card, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { PrimaryButton } from "@/components/PrimaryButton";
import type { ChildGamesStackParamList } from "@/types/navigation";
import { colors, radii, shadows } from "@/theme/theme";
import { useChildProfile } from "@/hooks/useChildProfile";
import { supabase } from "@/services/supabase";
import { formatAppError } from "@/utils/errors";

type Props = NativeStackScreenProps<ChildGamesStackParamList, "GamePlay">;

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const SHAPES = [
  { id: "circle", label: "Circle", glyph: "●", sides: 0 },
  { id: "square", label: "Square", glyph: "■", sides: 4 },
  { id: "triangle", label: "Triangle", glyph: "▲", sides: 3 },
  { id: "diamond", label: "Diamond", glyph: "◆", sides: 4 },
  { id: "star", label: "Star", glyph: "★", sides: 10 },
] as const;

const COLOR_OPTIONS = [
  { id: "red", label: "RED", bg: "#EF4444" },
  { id: "blue", label: "BLUE", bg: "#3B82F6" },
  { id: "green", label: "GREEN", bg: "#22C55E" },
  { id: "yellow", label: "YELLOW", bg: "#FACC15" },
  { id: "purple", label: "PURPLE", bg: "#A855F7" },
] as const;

const SCIENCE_Q = [
  { q: "The sun is a star.", a: true },
  { q: "Fish breathe air like humans.", a: false },
  { q: "Water boils at 100°C at sea level.", a: true },
  { q: "Plants need sunlight to grow.", a: true },
  { q: "The moon makes its own light.", a: false },
  { q: "Earth is the fourth planet from the Sun.", a: false },
  { q: "Magnets can attract some metals.", a: true },
  { q: "A day has 24 hours.", a: true },
] as const;

const SCIENCE_MCQ = [
  { q: "Which part of a plant takes in water?", choices: ["Roots", "Leaves", "Flowers", "Fruit"], answer: "Roots" },
  { q: "Which planet do we live on?", choices: ["Mars", "Earth", "Venus", "Jupiter"], answer: "Earth" },
  { q: "What do bees make?", choices: ["Honey", "Milk", "Bread", "Oil"], answer: "Honey" },
  { q: "What gas do people need to breathe?", choices: ["Oxygen", "Helium", "Hydrogen", "Nitrogen"], answer: "Oxygen" },
] as const;

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickChoices(correct: string, pool: string[], count: number): string[] {
  const wrong = shuffle(pool.filter((x) => x !== correct)).slice(0, count - 1);
  return shuffle([correct, ...wrong]);
}

type AlphabetRound = { prompt: string; answer: string; choices: string[] };
type ColorRound =
  | { mode: "blob"; prompt: string; answer: string; choices: { id: string; label: string; bg: string }[] }
  | { mode: "text"; prompt: string; answer: string; choices: string[] };
type ShapeRound = { prompt: string; answer: string; choices: { id: string; label: string; glyph: string; sides: number }[]; showLabelsOnly?: boolean };
type ScienceRound =
  | { mode: "tf"; q: string; a: boolean }
  | { mode: "mcq"; q: string; answer: string; choices: string[] };

type NumberRound = {
  prompt: string;
  answer: number;
  choices: number[];
};

type DifficultyTier = "easy" | "medium" | "hard";

function getDifficultyTier(level: number): DifficultyTier {
  if (level <= 3) {
    return "easy";
  }
  if (level >= 8) {
    return "hard";
  }
  return "medium";
}

function getGameSettings(level: number, gameId: Props["route"]["params"]["gameId"]) {
  const tier = getDifficultyTier(level);
  const baseChoices = tier === "easy" ? 3 : tier === "hard" ? 5 : 4;
  const rounds = tier === "easy" ? 4 : tier === "hard" ? 6 : 5;
  const numberMax = tier === "easy" ? 8 : tier === "hard" ? 24 : 14;
  const xpPerCorrect = tier === "easy" ? 8 : tier === "hard" ? 14 : 10;
  const sciencePool = tier === "easy" ? SCIENCE_Q.slice(0, 5) : tier === "medium" ? SCIENCE_Q.slice(0, 7) : SCIENCE_Q;
  const choiceCount = gameId === "numbers" ? Math.max(3, baseChoices - 1) : baseChoices;

  return { tier, rounds, choiceCount, numberMax, xpPerCorrect, sciencePool };
}

function createAlphabetRound(settings: ReturnType<typeof getGameSettings>): AlphabetRound {
  if (settings.tier === "easy") {
    const target = LETTERS[randomInt(0, LETTERS.length - 1)];
    return {
      prompt: `Tap the letter: ${target}`,
      answer: target,
      choices: pickChoices(target, LETTERS, settings.choiceCount),
    };
  }

  if (settings.tier === "medium") {
    const target = LETTERS[randomInt(0, LETTERS.length - 1)];
    const lowerPool = LETTERS.map((l) => l.toLowerCase());
    return {
      prompt: `Tap lowercase for: ${target}`,
      answer: target.toLowerCase(),
      choices: pickChoices(target.toLowerCase(), lowerPool, settings.choiceCount),
    };
  }

  const currentIdx = randomInt(0, LETTERS.length - 2);
  const current = LETTERS[currentIdx];
  const next = LETTERS[currentIdx + 1];
  return {
    prompt: `Which letter comes after ${current}?`,
    answer: next,
    choices: pickChoices(next, LETTERS, settings.choiceCount),
  };
}

function createColorRound(settings: ReturnType<typeof getGameSettings>): ColorRound {
  if (settings.tier === "easy") {
    const pool = shuffle([...COLOR_OPTIONS]).slice(0, settings.choiceCount);
    const target = pool[randomInt(0, pool.length - 1)];
    return {
      mode: "blob",
      prompt: `Tap the color: ${target.label}`,
      answer: target.id,
      choices: pool,
    };
  }

  if (settings.tier === "medium") {
    const mixes = [
      { prompt: "RED + BLUE =", answer: "PURPLE" },
      { prompt: "RED + YELLOW =", answer: "ORANGE" },
      { prompt: "BLUE + YELLOW =", answer: "GREEN" },
    ] as const;
    const selected = mixes[randomInt(0, mixes.length - 1)];
    return {
      mode: "text",
      prompt: `Color mix challenge: ${selected.prompt}`,
      answer: selected.answer,
      choices: shuffle(["PURPLE", "GREEN", "ORANGE", "BROWN"]).slice(0, settings.choiceCount),
    };
  }

  const warmCool = [
    { prompt: "Pick a warm color", answer: "RED", options: ["RED", "BLUE", "GREEN", "PURPLE"] },
    { prompt: "Pick a cool color", answer: "BLUE", options: ["BLUE", "RED", "YELLOW", "ORANGE"] },
  ] as const;
  const selected = warmCool[randomInt(0, warmCool.length - 1)];
  return {
    mode: "text",
    prompt: selected.prompt,
    answer: selected.answer,
    choices: shuffle([...selected.options]).slice(0, settings.choiceCount),
  };
}

function createShapeRound(settings: ReturnType<typeof getGameSettings>): ShapeRound {
  if (settings.tier === "easy") {
    const pool = shuffle([...SHAPES]).slice(0, settings.choiceCount);
    const target = pool[randomInt(0, pool.length - 1)];
    return {
      prompt: `Find: ${target.label}`,
      answer: target.id,
      choices: shuffle([...pool]),
    };
  }

  if (settings.tier === "medium") {
    const polygonPool = SHAPES.filter((s) => s.sides > 0);
    const target = polygonPool[randomInt(0, polygonPool.length - 1)];
    const pool = shuffle([...polygonPool]).slice(0, settings.choiceCount);
    return {
      prompt: `Which shape has ${target.sides} sides?`,
      answer: target.id,
      choices: pool,
    };
  }

  const target = SHAPES.find((s) => s.id === "circle")!;
  const pool = shuffle([...SHAPES.filter((s) => s.id !== "circle")]).slice(0, Math.max(2, settings.choiceCount - 1));
  return {
    prompt: "Which one has no sides?",
    answer: target.id,
    choices: shuffle([target, ...pool]),
  };
}

function createNumberRound(gameId: Props["route"]["params"]["gameId"], settings: ReturnType<typeof getGameSettings>): NumberRound | null {
  if (gameId !== "numbers" && gameId !== "math") {
    return null;
  }

  const makeChoices = (answer: number) => {
    const pool = new Set<number>();
    pool.add(answer);
    while (pool.size < settings.choiceCount) {
      pool.add(randomInt(Math.max(0, answer - 10), answer + 10));
    }
    return shuffle([...pool]);
  };

  if (gameId === "numbers") {
    if (settings.tier === "easy") {
      const target = randomInt(1, 12);
      return {
        prompt: `Tap the number ${target}`,
        answer: target,
        choices: makeChoices(target),
      };
    }

    if (settings.tier === "medium") {
      const start = randomInt(8, 30);
      const missing = start + 2;
      return {
        prompt: `What comes next? ${start}, ${start + 1}, __`,
        answer: missing,
        choices: makeChoices(missing),
      };
    }

    const start = randomInt(10, 40);
    const step = randomInt(2, 5);
    const answer = start + step * 3;
    return {
      prompt: `Fill in the missing number: ${start}, ${start + step}, ${start + step * 2}, __`,
      answer,
      choices: makeChoices(answer),
    };
  }

  if (settings.tier === "easy") {
    const a = randomInt(1, 9);
    const b = randomInt(1, 9);
    const answer = a + b;
    return { prompt: `What is ${a} + ${b}?`, answer, choices: makeChoices(answer) };
  }

  if (settings.tier === "medium") {
    const useSubtract = Math.random() > 0.5;
    if (useSubtract) {
      const a = randomInt(8, 20);
      const b = randomInt(1, a - 1);
      const answer = a - b;
      return { prompt: `What is ${a} - ${b}?`, answer, choices: makeChoices(answer) };
    }
    const a = randomInt(5, settings.numberMax);
    const b = randomInt(5, settings.numberMax);
    const answer = a + b;
    return { prompt: `What is ${a} + ${b}?`, answer, choices: makeChoices(answer) };
  }

  const a = randomInt(2, 12);
  const b = randomInt(2, 12);
  const answer = a * b;
  return { prompt: `What is ${a} × ${b}?`, answer, choices: makeChoices(answer) };
}

export function ChildMiniGameScreen({ route, navigation }: Props) {
  const { gameId, taskId } = route.params;
  const { child, refresh } = useChildProfile();
  const difficultyLevel = child?.difficulty_level ?? 5;
  const settings = useMemo(() => getGameSettings(difficultyLevel, gameId), [difficultyLevel, gameId]);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSavingReward, setIsSavingReward] = useState(false);
  const [rewardSaved, setRewardSaved] = useState(false);

  useEffect(() => {
    setFeedback(null);
  }, [round]);

  const alphabetRound = useMemo(() => {
    if (gameId !== "alphabet") {
      return null;
    }
    return createAlphabetRound(settings);
  }, [gameId, round, settings]);

  const numberRound = useMemo(() => createNumberRound(gameId, settings), [gameId, settings, round]);

  const colorRound = useMemo(() => {
    if (gameId !== "colors") {
      return null;
    }
    return createColorRound(settings);
  }, [gameId, round, settings]);

  const shapeRound = useMemo(() => {
    if (gameId !== "shapes") {
      return null;
    }
    return createShapeRound(settings);
  }, [gameId, round, settings]);

  const scienceRound = useMemo(() => {
    if (gameId !== "science") {
      return null;
    }
    if (settings.tier === "hard") {
      const q = SCIENCE_MCQ[round % SCIENCE_MCQ.length];
      return { mode: "mcq", q: q.q, answer: q.answer, choices: shuffle([...q.choices]).slice(0, settings.choiceCount) } as ScienceRound;
    }
    const tf = settings.sciencePool[round % settings.sciencePool.length];
    return { mode: "tf", ...tf } as ScienceRound;
  }, [gameId, round, settings]);

  const advance = useCallback(
    (correct: boolean) => {
      if (correct) {
        setScore((s) => s + 1);
        setFeedback("Nice!");
      } else {
        setFeedback("Try the next one!");
      }
      const next = round + 1;
      if (next >= settings.rounds) {
        setDone(true);
      } else {
        setRound(next);
      }
    },
    [round, settings.rounds]
  );

  const restart = () => {
    setRound(0);
    setScore(0);
    setDone(false);
    setFeedback(null);
    setSaveError(null);
    setRewardSaved(false);
  };

  const xpEarned = score * settings.xpPerCorrect;
  const difficultyText = `Difficulty ${difficultyLevel} (${settings.tier})`;

  useEffect(() => {
    async function award() {
      if (!done || rewardSaved || !child || !supabase) {
        return;
      }
      // If this game run is tied to a Learning Task, the task completion path awards points.
      if (taskId) {
        setRewardSaved(true);
        return;
      }
      if (xpEarned <= 0) {
        return;
      }
      setIsSavingReward(true);
      setSaveError(null);
      const { error } = await supabase.rpc("award_child_points", {
        p_child_id: child.id,
        p_points: xpEarned,
        p_event_type: "game_completed",
        p_metadata: { game_id: gameId, score, rounds: settings.rounds, difficulty: difficultyLevel },
      });
      setIsSavingReward(false);
      if (error) {
        setSaveError(formatAppError(error));
        return;
      }
      setRewardSaved(true);
      await refresh();
    }
    void award();
  }, [done, rewardSaved, child, xpEarned, gameId, score, settings.rounds, difficultyLevel, refresh, taskId]);

  useEffect(() => {
    async function completeLearningTask() {
      if (!done || !taskId || !supabase || !child || rewardSaved) {
        return;
      }
      setSaveError(null);
      setIsSavingReward(true);

      const { data: task, error: taskError } = await supabase
        .from("tasks")
        .select("xp_reward, status")
        .eq("id", taskId)
        .maybeSingle();

      if (taskError || !task) {
        setIsSavingReward(false);
        setSaveError(formatAppError(taskError ?? new Error("Could not load learning task.")));
        return;
      }

      if (task.status !== "completed") {
        const { error: updateError } = await supabase
          .from("tasks")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", taskId);
        if (updateError) {
          setIsSavingReward(false);
          setSaveError(formatAppError(updateError));
          return;
        }

        const { error: awardError } = await supabase.rpc("award_child_points", {
          p_child_id: child.id,
          p_points: task.xp_reward ?? 0,
          p_event_type: "learning_completed",
          p_metadata: { task_id: taskId, game_id: gameId, score, rounds: settings.rounds, source: "learning_task" },
        });
        if (awardError) {
          setIsSavingReward(false);
          setSaveError(formatAppError(awardError));
          return;
        }
      }

      setIsSavingReward(false);
      setRewardSaved(true);
      await refresh(true);
    }
    void completeLearningTask();
  }, [done, taskId, child, gameId, score, settings.rounds, refresh, rewardSaved]);

  if (done) {
    return (
      <ScreenContainer scroll>
        <Card style={[styles.summaryCard, shadows.card]}>
          <Card.Content style={styles.summaryInner}>
            <MaterialCommunityIcons name="trophy" size={56} color={colors.warning} />
            <Text variant="headlineSmall" style={styles.summaryTitle}>
              Game complete
            </Text>
            <Text variant="titleMedium" style={styles.summaryScore}>
              Score: {score} / {settings.rounds}
            </Text>
            <Text variant="bodyMedium" style={styles.summaryXp}>
              {taskId ? "Completing learning task..." : `+${xpEarned} XP earned this round`}
            </Text>
            {isSavingReward ? (
              <Text variant="bodySmall" style={styles.summaryMeta}>
                Saving reward...
              </Text>
            ) : null}
            {saveError ? (
              <Text variant="bodySmall" style={styles.errorText}>
                {saveError}
              </Text>
            ) : null}
            <Text variant="bodySmall" style={styles.summaryMeta}>
              {difficultyText}
            </Text>
            <PrimaryButton label="Play again" onPress={restart} />
            <PrimaryButton label="Back to games" mode="outlined" onPress={() => navigation.navigate("GamesList")} />
          </Card.Content>
        </Card>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
      <View style={styles.hud}>
        <Text variant="labelLarge" style={styles.hudText}>
          Round {round + 1} / {settings.rounds}
        </Text>
        <View style={styles.hudStars}>
          <MaterialCommunityIcons name="star" size={18} color={colors.warning} />
          <Text variant="labelLarge" style={styles.hudText}>
            {score}
          </Text>
        </View>
      </View>
      <Text variant="bodySmall" style={styles.difficultyPill}>
        {difficultyText}
      </Text>

      {feedback ? (
        <Text variant="bodyMedium" style={styles.feedback}>
          {feedback}
        </Text>
      ) : null}

      {gameId === "alphabet" && alphabetRound ? (
        <View style={styles.block}>
          <Text variant="titleLarge" style={styles.prompt}>
            {alphabetRound.prompt}
          </Text>
          <View style={styles.choiceGrid}>
            {alphabetRound.choices.map((ch) => (
              <Pressable
                key={ch}
                style={({ pressed }) => [styles.choiceBtn, pressed && styles.choicePressed]}
                onPress={() => advance(ch === alphabetRound.answer)}
              >
                <Text variant="headlineMedium" style={styles.choiceGlyph}>
                  {ch}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {(gameId === "numbers" || gameId === "math") && numberRound ? (
        <View style={styles.block}>
          <Text variant="titleLarge" style={styles.prompt}>
            {numberRound.prompt}
          </Text>
          <View style={styles.choiceGrid}>
            {numberRound.choices.map((n) => (
              <Pressable
                key={n}
                style={({ pressed }) => [styles.choiceBtn, pressed && styles.choicePressed]}
                onPress={() => advance(n === numberRound.answer)}
              >
                <Text variant="headlineSmall" style={styles.choiceNum}>
                  {n}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {gameId === "colors" && colorRound ? (
        <View style={styles.block}>
          <Text variant="titleLarge" style={styles.prompt}>
            {colorRound.prompt}
          </Text>
          {colorRound.mode === "blob" ? (
            <View style={styles.colorRow}>
              {colorRound.choices.map((c) => (
                <Pressable
                  key={c.id}
                  accessibilityRole="button"
                  accessibilityLabel={c.label}
                  style={({ pressed }) => [styles.colorBlob, { backgroundColor: c.bg }, pressed && styles.choicePressed]}
                  onPress={() => advance(c.id === colorRound.answer)}
                />
              ))}
            </View>
          ) : (
            <View style={styles.choiceGrid}>
              {colorRound.choices.map((choice) => (
                <Pressable key={choice} style={({ pressed }) => [styles.choiceBtn, pressed && styles.choicePressed]} onPress={() => advance(choice === colorRound.answer)}>
                  <Text variant="titleMedium" style={styles.choiceNum}>
                    {choice}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      ) : null}

      {gameId === "shapes" && shapeRound ? (
        <View style={styles.block}>
          <Text variant="titleLarge" style={styles.prompt}>
            {shapeRound.prompt}
          </Text>
          <View style={styles.choiceGrid}>
            {shapeRound.choices.map((s) => (
              <Pressable
                key={s.id}
                style={({ pressed }) => [styles.choiceBtn, pressed && styles.choicePressed]}
                onPress={() => advance(s.id === shapeRound.answer)}
              >
                <Text style={styles.shapeGlyph}>{s.glyph}</Text>
                <Text variant="labelMedium">{s.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {gameId === "science" && scienceRound ? (
        <View style={styles.block}>
          <Card style={[styles.scienceCard, shadows.card]}>
            <Card.Content>
              <MaterialCommunityIcons name="flask" size={36} color={colors.info} />
              <Text variant="titleMedium" style={styles.scienceQ}>
                {scienceRound.q}
              </Text>
            </Card.Content>
          </Card>
          {scienceRound.mode === "tf" ? (
            <View style={styles.tfRow}>
              <PrimaryButton label="True" onPress={() => advance(true === scienceRound.a)} />
              <PrimaryButton label="False" mode="outlined" onPress={() => advance(false === scienceRound.a)} />
            </View>
          ) : (
            <View style={styles.choiceGrid}>
              {scienceRound.choices.map((choice) => (
                <Pressable key={choice} style={({ pressed }) => [styles.choiceBtn, pressed && styles.choicePressed]} onPress={() => advance(choice === scienceRound.answer)}>
                  <Text variant="titleMedium" style={styles.choiceNum}>
                    {choice}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hud: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radii.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  hudText: {
    color: colors.text,
    fontWeight: "700",
  },
  hudStars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  feedback: {
    color: colors.primaryDark,
    textAlign: "center",
  },
  difficultyPill: {
    alignSelf: "center",
    color: colors.primaryDark,
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.pill,
    overflow: "hidden",
    fontWeight: "700",
  },
  block: {
    gap: 16,
  },
  prompt: {
    color: colors.text,
    fontWeight: "700",
    textAlign: "center",
  },
  highlight: {
    color: colors.primaryDark,
  },
  choiceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
  },
  choiceBtn: {
    minWidth: "44%",
    minHeight: 72,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    ...shadows.card,
  },
  choicePressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  choiceGlyph: {
    color: colors.text,
    fontWeight: "800",
  },
  choiceNum: {
    color: colors.text,
    fontWeight: "800",
  },
  colorRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    flexWrap: "wrap",
  },
  colorBlob: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    ...shadows.card,
  },
  shapeGlyph: {
    fontSize: 36,
    color: colors.text,
  },
  scienceCard: {
    borderRadius: radii.md,
    backgroundColor: "#EEF6FF",
  },
  scienceQ: {
    marginTop: 8,
    color: colors.text,
    fontWeight: "600",
  },
  tfRow: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  summaryCard: {
    borderRadius: radii.lg,
  },
  summaryInner: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  summaryTitle: {
    fontWeight: "800",
    color: colors.text,
  },
  summaryScore: {
    color: colors.primaryDark,
  },
  summaryXp: {
    color: colors.subtext,
  },
  summaryMeta: {
    color: colors.primaryDark,
    fontWeight: "600",
    marginBottom: 8,
  },
  errorText: {
    color: "#B91C1C",
    textAlign: "center",
  },
});
