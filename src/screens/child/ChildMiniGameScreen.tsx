import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Card, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { PrimaryButton } from "@/components/PrimaryButton";
import type { ChildGamesStackParamList } from "@/types/navigation";
import { colors, radii, shadows } from "@/theme/theme";

type Props = NativeStackScreenProps<ChildGamesStackParamList, "GamePlay">;

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const SHAPES = [
  { id: "circle", label: "Circle", glyph: "●" },
  { id: "square", label: "Square", glyph: "■" },
  { id: "triangle", label: "Triangle", glyph: "▲" },
] as const;

const COLOR_OPTIONS = [
  { id: "red", label: "RED", bg: "#EF4444" },
  { id: "blue", label: "BLUE", bg: "#3B82F6" },
  { id: "green", label: "GREEN", bg: "#22C55E" },
] as const;

const SCIENCE_Q = [
  { q: "The sun is a star.", a: true },
  { q: "Fish breathe air like humans.", a: false },
  { q: "Water boils at 100°C at sea level.", a: true },
  { q: "Plants need sunlight to grow.", a: true },
  { q: "The moon makes its own light.", a: false },
] as const;

const ROUNDS = 5;

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

export function ChildMiniGameScreen({ route, navigation }: Props) {
  const { gameId } = route.params;
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setFeedback(null);
  }, [round]);

  const alphabetRound = useMemo(() => {
    if (gameId !== "alphabet") {
      return null;
    }
    const target = LETTERS[randomInt(0, LETTERS.length - 1)];
    const choices = pickChoices(target, LETTERS, 4);
    return { target, choices };
  }, [gameId, round]);

  const numberRound = useMemo(() => {
    if (gameId !== "numbers" && gameId !== "math") {
      return null;
    }
    const hard = gameId === "math";
    const a = randomInt(1, hard ? 12 : 9);
    const b = randomInt(1, hard ? 12 : 9);
    const answer = a + b;
    const pool = new Set<number>();
    pool.add(answer);
    while (pool.size < 4) {
      pool.add(randomInt(Math.max(1, answer - 5), answer + 5));
    }
    const choices = shuffle([...pool]);
    return { a, b, answer, choices };
  }, [gameId, round]);

  const colorRound = useMemo(() => {
    if (gameId !== "colors") {
      return null;
    }
    const target = COLOR_OPTIONS[randomInt(0, COLOR_OPTIONS.length - 1)];
    const choices = shuffle([...COLOR_OPTIONS]);
    return { target, choices };
  }, [gameId, round]);

  const shapeRound = useMemo(() => {
    if (gameId !== "shapes") {
      return null;
    }
    const target = SHAPES[randomInt(0, SHAPES.length - 1)];
    const choices = shuffle([...SHAPES]);
    return { target, choices };
  }, [gameId, round]);

  const scienceRound = useMemo(() => {
    if (gameId !== "science") {
      return null;
    }
    return SCIENCE_Q[round % SCIENCE_Q.length];
  }, [gameId, round]);

  const advance = useCallback(
    (correct: boolean) => {
      if (correct) {
        setScore((s) => s + 1);
        setFeedback("Nice!");
      } else {
        setFeedback("Try the next one!");
      }
      const next = round + 1;
      if (next >= ROUNDS) {
        setDone(true);
      } else {
        setRound(next);
      }
    },
    [round]
  );

  const restart = () => {
    setRound(0);
    setScore(0);
    setDone(false);
    setFeedback(null);
  };

  const xpEarned = score * 10;

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
              Score: {score} / {ROUNDS}
            </Text>
            <Text variant="bodyMedium" style={styles.summaryXp}>
              +{xpEarned} XP earned this round
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
          Round {round + 1} / {ROUNDS}
        </Text>
        <View style={styles.hudStars}>
          <MaterialCommunityIcons name="star" size={18} color={colors.warning} />
          <Text variant="labelLarge" style={styles.hudText}>
            {score}
          </Text>
        </View>
      </View>

      {feedback ? (
        <Text variant="bodyMedium" style={styles.feedback}>
          {feedback}
        </Text>
      ) : null}

      {gameId === "alphabet" && alphabetRound ? (
        <View style={styles.block}>
          <Text variant="titleLarge" style={styles.prompt}>
            Tap the letter:{" "}
            <Text style={styles.highlight}>{alphabetRound.target}</Text>
          </Text>
          <View style={styles.choiceGrid}>
            {alphabetRound.choices.map((ch) => (
              <Pressable
                key={ch}
                style={({ pressed }) => [styles.choiceBtn, pressed && styles.choicePressed]}
                onPress={() => advance(ch === alphabetRound.target)}
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
            What is {numberRound.a} + {numberRound.b}?
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
            Tap the color: <Text style={styles.highlight}>{colorRound.target.label}</Text>
          </Text>
          <View style={styles.colorRow}>
            {colorRound.choices.map((c) => (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                accessibilityLabel={c.label}
                style={({ pressed }) => [
                  styles.colorBlob,
                  { backgroundColor: c.bg },
                  pressed && styles.choicePressed,
                ]}
                onPress={() => advance(c.id === colorRound.target.id)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {gameId === "shapes" && shapeRound ? (
        <View style={styles.block}>
          <Text variant="titleLarge" style={styles.prompt}>
            Find: <Text style={styles.highlight}>{shapeRound.target.label}</Text>
          </Text>
          <View style={styles.choiceGrid}>
            {shapeRound.choices.map((s) => (
              <Pressable
                key={s.id}
                style={({ pressed }) => [styles.choiceBtn, pressed && styles.choicePressed]}
                onPress={() => advance(s.id === shapeRound.target.id)}
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
          <View style={styles.tfRow}>
            <PrimaryButton label="True" onPress={() => advance(true === scienceRound.a)} />
            <PrimaryButton label="False" mode="outlined" onPress={() => advance(false === scienceRound.a)} />
          </View>
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
    marginBottom: 8,
  },
});
