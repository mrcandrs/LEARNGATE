import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Card, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ConfettiBurst } from "@/components/ConfettiBurst";
import { PrimaryButton } from "@/components/PrimaryButton";
import type { ChildActivitiesStackParamList } from "@/types/navigation";
import { radii, shadows } from "@/theme/theme";
import { useAppColors } from "@/theme/useAppColors";
import { useChildProfile } from "@/hooks/useChildProfile";
import { supabase } from "@/services/supabase";
import { formatAppError } from "@/utils/errors";
import { isLikelyOfflineError, OFFLINE_MSG } from "@/services/offlineMessages";
import { useAudioGuidance } from "@/store/AudioGuidanceContext";
import { BONUS_PLAY_DIFFICULTY_LEVEL, getGameSettings } from "@/data/gameDifficulty";
import { getAgeBandForChild } from "@/data/childAgeBands";
import { isGameAllowedForChildAge } from "@/data/childGames";
import { getChildAge } from "@/utils/childBirthday";
import {
  COLOR_CATEGORY_CHALLENGES,
  COLOR_MIX_CHALLENGES,
  COUNTING_SCENARIOS,
  scienceMcqPoolForTier,
  sciencePoolForTier,
  VOWELS,
  WORDS_BY_FIRST_LETTER,
} from "@/data/gameRoundBanks";
import { useLocale } from "@/store/LocaleContext";
import { localizedAgeBand } from "@/i18n/helpers";

type Props = NativeStackScreenProps<ChildActivitiesStackParamList, "GamePlay">;

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const SHAPES = [
  { id: "circle", label: "Circle", glyph: "●", sides: 0 },
  { id: "square", label: "Square", glyph: "■", sides: 4 },
  { id: "rectangle", label: "Rectangle", glyph: "▬", sides: 4 },
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
  { id: "orange", label: "ORANGE", bg: "#F97316" },
] as const;

function shuffle<T>(arr: readonly T[]): T[] {
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

function pickChoices(correct: string, pool: readonly string[], count: number): string[] {
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

function makeNumberChoices(answer: number, count: number) {
  const pool = new Set<number>();
  pool.add(answer);
  while (pool.size < count) {
    const delta = randomInt(1, 4);
    pool.add(Math.max(0, answer + (Math.random() > 0.5 ? delta : -delta)));
  }
  return shuffle([...pool]);
}

function wordForLetter(letter: string): string {
  const list = WORDS_BY_FIRST_LETTER[letter] ?? ["Word"];
  return list[randomInt(0, list.length - 1)];
}

function createAlphabetRound(settings: ReturnType<typeof getGameSettings>, slot: number): AlphabetRound {
  const s = slot % 10;

  if (settings.tier === "easy") {
    if (s <= 2) {
      const target = LETTERS[randomInt(0, LETTERS.length - 1)];
      return { prompt: `Tap the letter: ${target}`, answer: target, choices: pickChoices(target, LETTERS, settings.choiceCount) };
    }
    if (s === 3) {
      const vowelList = LETTERS.filter((l) => VOWELS.has(l));
      const target = vowelList[randomInt(0, vowelList.length - 1)];
      return { prompt: "Tap a vowel (A, E, I, O, U)", answer: target, choices: pickChoices(target, vowelList, settings.choiceCount) };
    }
    const letter = LETTERS[randomInt(0, LETTERS.length - 1)];
    const word = wordForLetter(letter);
    return {
      prompt: `"${word}" starts with which letter?`,
      answer: letter,
      choices: pickChoices(letter, LETTERS, settings.choiceCount),
    };
  }

  if (settings.tier === "medium") {
    if (s % 2 === 0) {
      const target = LETTERS[randomInt(0, LETTERS.length - 1)];
      const lowerPool = LETTERS.map((l) => l.toLowerCase());
      return {
        prompt: `Tap the lowercase letter for: ${target}`,
        answer: target.toLowerCase(),
        choices: pickChoices(target.toLowerCase(), lowerPool, settings.choiceCount),
      };
    }
    const idx = randomInt(1, LETTERS.length - 2);
    const current = LETTERS[idx];
    const next = LETTERS[idx + 1];
    return {
      prompt: `Which letter comes AFTER ${current}?`,
      answer: next,
      choices: pickChoices(next, LETTERS, settings.choiceCount),
    };
  }

  if (s % 3 === 0) {
    const idx = randomInt(1, LETTERS.length - 1);
    const current = LETTERS[idx];
    const prev = LETTERS[idx - 1];
    return {
      prompt: `Which letter comes BEFORE ${current}?`,
      answer: prev,
      choices: pickChoices(prev, LETTERS, settings.choiceCount),
    };
  }
  if (s % 3 === 1) {
    const word = "LEARN";
    const missingIdx = randomInt(0, word.length - 1);
    const answer = word[missingIdx];
    return {
      prompt: `Fill the missing letter: ${word.split("").map((c, i) => (i === missingIdx ? "_" : c)).join("")}`,
      answer,
      choices: pickChoices(answer, LETTERS, settings.choiceCount),
    };
  }
  const idx = randomInt(0, LETTERS.length - 2);
  const current = LETTERS[idx];
  const next = LETTERS[idx + 1];
  return {
    prompt: `What is the next letter after ${current}?`,
    answer: next,
    choices: pickChoices(next, LETTERS, settings.choiceCount),
  };
}

function createColorRound(settings: ReturnType<typeof getGameSettings>, slot: number): ColorRound {
  const s = slot % 10;

  if (settings.tier === "easy") {
    const pool = shuffle([...COLOR_OPTIONS]).slice(0, settings.choiceCount);
    const target = pool[randomInt(0, pool.length - 1)];
    const prompts = [`Tap the color: ${target.label}`, `Which swatch is ${target.label}?`, `Find ${target.label}`];
    return { mode: "blob", prompt: prompts[s % prompts.length], answer: target.id, choices: pool };
  }

  if (settings.tier === "medium") {
    if (s % 2 === 0) {
      const challenge = COLOR_MIX_CHALLENGES[s % COLOR_MIX_CHALLENGES.length];
      return {
        mode: "text",
        prompt: challenge.prompt,
        answer: challenge.answer,
        choices: pickChoices(challenge.answer, challenge.pool, settings.choiceCount),
      };
    }
    const pool = shuffle([...COLOR_OPTIONS]).slice(0, settings.choiceCount);
    const target = pool[0];
    return { mode: "blob", prompt: `Which color is ${target.label}?`, answer: target.id, choices: pool };
  }

  const challenge = COLOR_CATEGORY_CHALLENGES[s % COLOR_CATEGORY_CHALLENGES.length];
  return {
    mode: "text",
    prompt: challenge.prompt,
    answer: challenge.answer,
    choices: pickChoices(challenge.answer, challenge.pool, settings.choiceCount),
  };
}

function createShapeRound(settings: ReturnType<typeof getGameSettings>, slot: number): ShapeRound {
  const s = slot % 10;
  const polygonPool = SHAPES.filter((sh) => sh.sides > 0);

  if (settings.tier === "easy") {
    const pool = shuffle([...SHAPES]).slice(0, settings.choiceCount);
    const target = pool[randomInt(0, pool.length - 1)];
    const prompts = [`Find the ${target.label}`, `Tap the ${target.label}`, `Which shape is a ${target.label}?`];
    return { prompt: prompts[s % prompts.length], answer: target.id, choices: shuffle([...pool]) };
  }

  if (settings.tier === "medium") {
    if (s % 2 === 0) {
      const target = polygonPool[randomInt(0, polygonPool.length - 1)];
      const pool = shuffle([...polygonPool]).slice(0, settings.choiceCount);
      return { prompt: `Which shape has ${target.sides} sides?`, answer: target.id, choices: pool };
    }
    const target = SHAPES[randomInt(0, SHAPES.length - 1)];
    const pool = shuffle([...SHAPES]).slice(0, settings.choiceCount);
    return { prompt: `Tap the ${target.label}`, answer: target.id, choices: pool };
  }

  if (s % 3 === 0) {
    const circle = SHAPES.find((sh) => sh.id === "circle")!;
    const pool = shuffle(SHAPES.filter((sh) => sh.id !== "circle")).slice(0, settings.choiceCount - 1);
    return { prompt: "Which shape has no corners?", answer: circle.id, choices: shuffle([circle, ...pool]) };
  }
  if (s % 3 === 1) {
    const star = SHAPES.find((sh) => sh.id === "star")!;
    const pool = shuffle(SHAPES.filter((sh) => sh.id !== "star")).slice(0, settings.choiceCount - 1);
    return { prompt: "Which shape has the most pointed tips?", answer: star.id, choices: shuffle([star, ...pool]) };
  }
  const target = polygonPool[randomInt(0, polygonPool.length - 1)];
  const pool = shuffle([...polygonPool]).slice(0, settings.choiceCount);
  return { prompt: `Pick the ${target.label}`, answer: target.id, choices: pool };
}

function createNumbersRound(settings: ReturnType<typeof getGameSettings>, slot: number): NumberRound {
  const s = slot % 10;

  if (settings.tier === "easy") {
    if (s < COUNTING_SCENARIOS.length) {
      const item = COUNTING_SCENARIOS[s];
      return { prompt: item.prompt, answer: item.answer, choices: makeNumberChoices(item.answer, settings.choiceCount) };
    }
    const target = randomInt(1, settings.numberMax);
    return { prompt: `Tap the number ${target}`, answer: target, choices: makeNumberChoices(target, settings.choiceCount) };
  }

  if (settings.tier === "medium") {
    if (s % 2 === 0) {
      const start = randomInt(2, 12);
      const answer = start + 2;
      return {
        prompt: `What comes next? ${start}, ${start + 1}, __`,
        answer,
        choices: makeNumberChoices(answer, settings.choiceCount),
      };
    }
    const a = randomInt(3, 15);
    const b = randomInt(3, 15);
    const bigger = Math.max(a, b);
    return {
      prompt: `Which number is bigger: ${a} or ${b}?`,
      answer: bigger,
      choices: makeNumberChoices(bigger, settings.choiceCount),
    };
  }

  const start = randomInt(5, 20);
  const step = s % 2 === 0 ? 2 : 5;
  const answer = start + step * 2;
  return {
    prompt: `Pattern: ${start}, ${start + step}, ${start + step * 2}, __`,
    answer,
    choices: makeNumberChoices(answer, settings.choiceCount),
  };
}

function createMathRound(settings: ReturnType<typeof getGameSettings>, slot: number): NumberRound {
  const s = slot % 10;

  if (settings.tier === "easy") {
    const a = randomInt(1, 5 + (s % 4));
    const b = randomInt(1, 5 + (s % 3));
    const answer = a + b;
    return { prompt: `What is ${a} + ${b}?`, answer, choices: makeNumberChoices(answer, settings.choiceCount) };
  }

  if (settings.tier === "medium") {
    if (s % 2 === 0) {
      const a = randomInt(10, settings.numberMax);
      const b = randomInt(1, Math.min(9, a - 1));
      const answer = a - b;
      return { prompt: `What is ${a} − ${b}?`, answer, choices: makeNumberChoices(answer, settings.choiceCount) };
    }
    const a = randomInt(4, settings.numberMax);
    const b = randomInt(4, settings.numberMax);
    const answer = a + b;
    return { prompt: `What is ${a} + ${b}?`, answer, choices: makeNumberChoices(answer, settings.choiceCount) };
  }

  if (s % 3 === 0) {
    const a = randomInt(2, 10);
    const b = randomInt(2, 10);
    const answer = a * b;
    return { prompt: `What is ${a} × ${b}?`, answer, choices: makeNumberChoices(answer, settings.choiceCount) };
  }
  const a = randomInt(12, settings.numberMax + 5);
  const b = randomInt(3, 9);
  const answer = a - b;
  return { prompt: `What is ${a} − ${b}?`, answer, choices: makeNumberChoices(answer, settings.choiceCount) };
}

function createScienceRound(settings: ReturnType<typeof getGameSettings>, slot: number): ScienceRound {
  const s = slot % 10;

  if (settings.tier === "hard" && s >= 4) {
    const pool = scienceMcqPoolForTier("hard");
    const item = pool[s % pool.length];
    return {
      mode: "mcq",
      q: item.q,
      answer: item.answer,
      choices: pickChoices(item.answer, item.choices, settings.choiceCount),
    };
  }

  if (settings.tier === "medium" && s >= 7) {
    const pool = scienceMcqPoolForTier("medium");
    const item = pool[s % pool.length];
    return {
      mode: "mcq",
      q: item.q,
      answer: item.answer,
      choices: pickChoices(item.answer, item.choices, settings.choiceCount),
    };
  }

  const pool = sciencePoolForTier(settings.tier);
  const item = pool[s % pool.length];
  return { mode: "tf", q: item.q, a: item.a };
}

export function ChildMiniGameScreen({ route, navigation }: Props) {
  const { gameId, taskId } = route.params;
  const { t } = useLocale();
  const c = useAppColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const { child, loading: profileLoading, error: profileError, refresh } = useChildProfile();
  const audio = useAudioGuidance();
  const [assignedDifficultyLevel, setAssignedDifficultyLevel] = useState<number | null>(null);

  useEffect(() => {
    if (!taskId || !supabase) {
      setAssignedDifficultyLevel(null);
      return;
    }
    let active = true;
    void supabase
      .from("tasks")
      .select("description")
      .eq("id", taskId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data?.description) {
          return;
        }
        try {
          const parsed = JSON.parse(data.description) as { difficultyLevel?: number };
          if (typeof parsed.difficultyLevel === "number") {
            setAssignedDifficultyLevel(parsed.difficultyLevel);
          }
        } catch {
          // legacy tasks without difficulty in description
        }
      });
    return () => {
      active = false;
    };
  }, [taskId]);

  const difficultyLevel = taskId
    ? (assignedDifficultyLevel ?? child?.difficulty_level ?? 5)
    : BONUS_PLAY_DIFFICULTY_LEVEL;
  const settings = useMemo(() => getGameSettings(difficultyLevel, gameId), [difficultyLevel, gameId]);
  const [questionOrder, setQuestionOrder] = useState(() => shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [celebrationKey, setCelebrationKey] = useState(0);
  const [feedback, setFeedback] = useState<boolean | null>(null);
  const [locked, setLocked] = useState(false);
  const lastSpokenRoundRef = useRef<number | null>(null);
  const promptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSavingReward, setIsSavingReward] = useState(false);
  const [rewardSaved, setRewardSaved] = useState(false);
  const awardInFlightRef = useRef(false);
  const taskCompleteInFlightRef = useRef(false);
  const audioEnabled = child?.audio_guide_enabled ?? audio.enabled;
  const audioRate = child?.audio_guide_rate ?? audio.rate;

  useEffect(() => {
    setFeedback(null);
  }, [round]);

  const questionSlot = questionOrder[round] ?? round;

  const alphabetRound = useMemo(() => {
    if (gameId !== "alphabet") return null;
    return createAlphabetRound(settings, questionSlot);
  }, [gameId, questionSlot, settings]);

  const numberRound = useMemo(() => {
    if (gameId === "numbers") return createNumbersRound(settings, questionSlot);
    if (gameId === "math") return createMathRound(settings, questionSlot);
    return null;
  }, [gameId, questionSlot, settings]);

  const colorRound = useMemo(() => {
    if (gameId !== "colors") return null;
    return createColorRound(settings, questionSlot);
  }, [gameId, questionSlot, settings]);

  const shapeRound = useMemo(() => {
    if (gameId !== "shapes") return null;
    return createShapeRound(settings, questionSlot);
  }, [gameId, questionSlot, settings]);

  const scienceRound = useMemo(() => {
    if (gameId !== "science") return null;
    return createScienceRound(settings, questionSlot);
  }, [gameId, questionSlot, settings]);

  const spokenPrompt = useMemo(() => {
    if (profileLoading || profileError || done) {
      return null;
    }
    if (gameId === "science") {
      if (!scienceRound) return null;
      return scienceRound.mode === "mcq" ? scienceRound.q : scienceRound.q;
    }
    if (gameId === "alphabet") {
      return alphabetRound?.prompt ?? null;
    }
    if (gameId === "colors") {
      return colorRound?.prompt ?? null;
    }
    if (gameId === "shapes") {
      return shapeRound?.prompt ?? null;
    }
    return numberRound?.prompt ?? null;
  }, [alphabetRound, colorRound, done, gameId, numberRound, profileError, profileLoading, scienceRound, shapeRound]);

  useEffect(() => {
    if (promptTimerRef.current) {
      clearTimeout(promptTimerRef.current);
      promptTimerRef.current = null;
    }
    if (!spokenPrompt) return;
    // If feedback is still showing, let it be spoken first; prompt will speak after feedback clears.
    if (feedback) return;
    if (lastSpokenRoundRef.current === round) return;
    lastSpokenRoundRef.current = round;
    promptTimerRef.current = setTimeout(() => {
      audio.speak(spokenPrompt, { enabled: audioEnabled, rate: audioRate });
    }, 250);
  }, [spokenPrompt, audio, feedback, round, audioEnabled, audioRate]);

  useEffect(() => {
    return () => {
      if (promptTimerRef.current) {
        clearTimeout(promptTimerRef.current);
        promptTimerRef.current = null;
      }
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
      audio.stop();
    };
  }, [audio]);

  const advance = useCallback(
    (correct: boolean) => {
      if (locked) {
        return;
      }
      setLocked(true);
      if (correct) {
        setScore((s) => s + 1);
        setFeedback(true);
        audio.speak(t("child.game.correct"), { enabled: audioEnabled, rate: audioRate });
      } else {
        setFeedback(false);
        audio.speak(t("child.game.wrong"), { enabled: audioEnabled, rate: audioRate });
      }
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
      }
      advanceTimerRef.current = setTimeout(() => {
        const next = round + 1;
        if (next >= settings.rounds) {
          setDone(true);
          setCelebrationKey((key) => key + 1);
        } else {
          setRound(next);
        }
        setLocked(false);
      }, 700);
    },
    [round, settings.rounds, audio, locked, audioEnabled, audioRate]
  );

  const restart = () => {
    setQuestionOrder(shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
    setRound(0);
    setScore(0);
    setDone(false);
    setFeedback(null);
    setSaveError(null);
    setRewardSaved(false);
    lastSpokenRoundRef.current = null;
  };

  const xpEarned = score * settings.xpPerCorrect;
  const difficultyLabel =
    settings.tier === "easy"
      ? t("child.game.difficultyEasy")
      : settings.tier === "hard"
        ? t("child.game.difficultyHard")
        : t("child.game.difficultyMedium");
  const difficultyText = t("child.game.difficulty", { level: difficultyLabel });

  useEffect(() => {
    async function award() {
      if (!done || rewardSaved || awardInFlightRef.current || !child || !supabase) {
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
      awardInFlightRef.current = true;
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
        setSaveError(isLikelyOfflineError(error) ? OFFLINE_MSG.award : formatAppError(error));
        awardInFlightRef.current = false;
        return;
      }
      setRewardSaved(true);
      awardInFlightRef.current = false;
      await refresh();
    }
    void award();
  }, [done, rewardSaved, child, xpEarned, gameId, score, settings.rounds, difficultyLevel, refresh, taskId]);

  useEffect(() => {
    async function completeLearningTask() {
      if (!done || rewardSaved || taskCompleteInFlightRef.current || !taskId || !supabase || !child) {
        return;
      }
      taskCompleteInFlightRef.current = true;
      setSaveError(null);
      setIsSavingReward(true);

      const { data: task, error: taskError } = await supabase
        .from("tasks")
        .select("xp_reward, status")
        .eq("id", taskId)
        .maybeSingle();

      if (taskError || !task) {
        setIsSavingReward(false);
        setSaveError(
          isLikelyOfflineError(taskError)
            ? OFFLINE_MSG.award
            : formatAppError(taskError ?? new Error("Could not load learning task.")),
        );
        taskCompleteInFlightRef.current = false;
        return;
      }

      if (task.status !== "completed") {
        const { error: updateError } = await supabase
          .from("tasks")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", taskId);
        if (updateError) {
          setIsSavingReward(false);
          setSaveError(isLikelyOfflineError(updateError) ? OFFLINE_MSG.award : formatAppError(updateError));
          taskCompleteInFlightRef.current = false;
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
          setSaveError(isLikelyOfflineError(awardError) ? OFFLINE_MSG.award : formatAppError(awardError));
          taskCompleteInFlightRef.current = false;
          return;
        }
      }

      setIsSavingReward(false);
      setRewardSaved(true);
      taskCompleteInFlightRef.current = false;
      await refresh(true);
    }
    void completeLearningTask();
  }, [done, taskId, child, gameId, score, settings.rounds, refresh, rewardSaved]);

  if (done) {
    return (
      <View style={styles.celebrationRoot}>
        <ConfettiBurst triggerKey={celebrationKey} />
        <ScreenContainer scroll>
          <Card style={[styles.summaryCard, { backgroundColor: c.card }, shadows.card]}>
            <Card.Content style={styles.summaryInner}>
              <MaterialCommunityIcons name="trophy" size={56} color={c.warning} />
              <Text variant="headlineSmall" style={styles.summaryTitle}>
                {t("child.game.complete")}
              </Text>
              <Text variant="titleMedium" style={styles.summaryScore}>
                {t("child.game.score", { score, rounds: settings.rounds })}
              </Text>
              <Text variant="bodyMedium" style={styles.summaryXp}>
                {taskId ? t("child.game.completingTask") : t("child.game.xpEarned", { xp: xpEarned })}
              </Text>
              {isSavingReward && !rewardSaved ? (
                <Text variant="bodySmall" style={styles.summaryMeta}>
                  {t("child.game.savingReward")}
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
              <PrimaryButton label={t("child.game.playAgain")} onPress={restart} />
              <PrimaryButton label={t("child.game.backToGames")} mode="outlined" onPress={() => navigation.navigate("ActivitiesMain")} />
            </Card.Content>
          </Card>
        </ScreenContainer>
      </View>
    );
  }

  if (profileLoading) {
    return (
      <ScreenContainer scroll>
        <Card style={[{ backgroundColor: c.card, borderRadius: radii.lg }, shadows.card]}>
          <Card.Content style={styles.summaryInner}>
            <MaterialCommunityIcons name="gamepad-variant-outline" size={42} color={c.primary} />
            <Text variant="titleMedium" style={styles.summaryTitle}>
              {t("child.game.preparing")}
            </Text>
          </Card.Content>
        </Card>
      </ScreenContainer>
    );
  }

  if (!taskId && child && !isGameAllowedForChildAge(gameId, getChildAge(child))) {
    const band = getAgeBandForChild(getChildAge(child));
    return (
      <ScreenContainer scroll>
        <Card style={[{ backgroundColor: c.card, borderRadius: radii.lg }, shadows.card]}>
          <Card.Content style={styles.summaryInner}>
            <MaterialCommunityIcons name="emoticon-sad-outline" size={48} color={c.subtext} />
            <Text variant="titleMedium" style={styles.summaryTitle}>
              {t("child.game.tooYoung")}
            </Text>
            <Text variant="bodyMedium" style={styles.summaryMeta}>
              {t("child.game.tooYoungHint", { band: localizedAgeBand(band.id, t).label, shortLabel: localizedAgeBand(band.id, t).shortLabel })}
            </Text>
            <PrimaryButton label={t("child.game.backToGames")} onPress={() => navigation.navigate("ActivitiesMain")} />
          </Card.Content>
        </Card>
      </ScreenContainer>
    );
  }

  if (!child) {
    return (
      <ScreenContainer scroll>
        <Card style={[{ backgroundColor: c.card, borderRadius: radii.lg }, shadows.card]}>
          <Card.Content style={styles.summaryInner}>
            <Text variant="bodyMedium" style={styles.errorText}>
              {profileError ?? t("child.game.couldNotLoadProfile")}
            </Text>
            <PrimaryButton label={t("child.game.backToGames")} mode="outlined" onPress={() => navigation.navigate("ActivitiesMain")} />
          </Card.Content>
        </Card>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
      <View style={styles.hud}>
        <Text variant="labelLarge" style={styles.hudText}>
          {t("child.game.round", { current: round + 1, total: settings.rounds })}
        </Text>
        <View style={styles.hudStars}>
          <MaterialCommunityIcons name="star" size={18} color={c.warning} />
          <Text variant="labelLarge" style={styles.hudText}>
            {score}
          </Text>
        </View>
      </View>
      <Text variant="bodySmall" style={styles.difficultyPill}>
        {difficultyText}
      </Text>

      {feedback != null ? (
        <View style={[styles.feedbackBanner, feedback ? styles.feedbackCorrect : styles.feedbackWrong]}>
          <MaterialCommunityIcons
            name={feedback ? "check-circle" : "close-circle"}
            size={18}
            color="#FFFFFF"
          />
          <Text variant="bodyMedium" style={styles.feedbackBannerText}>
            {feedback ? t("child.game.correct") : t("child.game.wrong")}
          </Text>
        </View>
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
                disabled={locked}
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
                disabled={locked}
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
              {colorRound.choices.map((colorOpt) => (
                <Pressable
                  key={colorOpt.id}
                  accessibilityRole="button"
                  accessibilityLabel={colorOpt.label}
                  style={({ pressed }) => [styles.colorBlob, { backgroundColor: colorOpt.bg }, pressed && styles.choicePressed]}
                  onPress={() => advance(colorOpt.id === colorRound.answer)}
                  disabled={locked}
                />
              ))}
            </View>
          ) : (
            <View style={styles.choiceGrid}>
              {colorRound.choices.map((choice) => (
                <Pressable
                  key={choice}
                  style={({ pressed }) => [styles.choiceBtn, pressed && styles.choicePressed]}
                  onPress={() => advance(choice === colorRound.answer)}
                  disabled={locked}
                >
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
                disabled={locked}
              >
                <Text style={styles.shapeGlyph}>{s.glyph}</Text>
                <Text variant="labelMedium" style={styles.shapeLabel}>
                  {s.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {gameId === "science" && scienceRound ? (
        <View style={styles.block}>
          <Card style={[styles.scienceCard, { backgroundColor: c.mutedSurface }, shadows.card]}>
            <Card.Content>
              <MaterialCommunityIcons name="flask" size={36} color={c.info} />
              <Text variant="titleMedium" style={styles.scienceQ}>
                {scienceRound.q}
              </Text>
            </Card.Content>
          </Card>
          {scienceRound.mode === "tf" ? (
            <View style={styles.tfRow}>
              <PrimaryButton label={t("common.true")} onPress={() => advance(true === scienceRound.a)} disabled={locked} />
              <PrimaryButton label={t("common.false")} mode="outlined" onPress={() => advance(false === scienceRound.a)} disabled={locked} />
            </View>
          ) : (
            <View style={styles.choiceGrid}>
              {scienceRound.choices.map((choice) => (
                <Pressable
                  key={choice}
                  style={({ pressed }) => [styles.choiceBtn, pressed && styles.choicePressed]}
                  onPress={() => advance(choice === scienceRound.answer)}
                  disabled={locked}
                >
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

const createStyles = (c: ReturnType<typeof useAppColors>) =>
  StyleSheet.create({
  celebrationRoot: {
    flex: 1,
  },
  hud: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: c.card,
    borderRadius: radii.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: c.border,
    ...shadows.card,
  },
  hudText: {
    color: c.text,
    fontWeight: "700",
  },
  hudStars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  feedback: {
    color: c.primaryDark,
    textAlign: "center",
  },
  feedbackBanner: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    marginTop: 8,
  },
  feedbackBannerText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  feedbackCorrect: {
    backgroundColor: "#16A34A",
  },
  feedbackWrong: {
    backgroundColor: "#DC2626",
  },
  difficultyPill: {
    alignSelf: "center",
    color: c.primaryDark,
    backgroundColor: c.surfaceTint,
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
    color: c.text,
    fontWeight: "700",
    textAlign: "center",
  },
  highlight: {
    color: c.primaryDark,
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
    backgroundColor: c.card,
    borderWidth: 2,
    borderColor: c.border,
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
    color: c.text,
    fontWeight: "800",
  },
  choiceNum: {
    color: c.text,
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
    borderColor: c.border,
    ...shadows.card,
  },
  shapeGlyph: {
    fontSize: 36,
    color: c.text,
  },
  shapeLabel: {
    color: c.subtext,
  },
  scienceCard: {
    borderRadius: radii.md,
  },
  scienceQ: {
    marginTop: 8,
    color: c.text,
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
    color: c.text,
  },
  summaryScore: {
    color: c.primaryDark,
  },
  summaryXp: {
    color: c.subtext,
  },
  summaryMeta: {
    color: c.primaryDark,
    fontWeight: "600",
    marginBottom: 8,
  },
  errorText: {
    color: c.danger,
    textAlign: "center",
  },
});
