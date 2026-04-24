import { Pressable, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Card, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ChildDashboardHeader } from "@/components/ChildDashboardHeader";
import { colors, radii, shadows } from "@/theme/theme";
import { useChildProfile } from "@/hooks/useChildProfile";
import { CHILD_GAME_CATALOG } from "@/data/childGames";
import type { ChildGamesStackParamList } from "@/types/navigation";

type GamesNav = NativeStackNavigationProp<ChildGamesStackParamList, "GamesList">;

export function ChildGamesScreen() {
  const navigation = useNavigation<GamesNav>();
  const { child } = useChildProfile();

  return (
    <ScreenContainer scroll contentPadding={0}>
      {child ? (
        <ChildDashboardHeader
          name={child.name}
          level={child.difficulty_level}
          stars={child.stars}
          dailyLimitMinutes={child.daily_limit_minutes}
          avatarUrl={child.avatar_url}
        />
      ) : null}
      <View style={styles.pad}>
        <View style={styles.sectionHead}>
          <MaterialCommunityIcons name="gamepad-variant" size={28} color={colors.primaryDark} />
          <Text variant="titleLarge" style={styles.sectionTitle}>
            Learning games
          </Text>
        </View>
        <Text variant="bodyMedium" style={styles.hint}>
          Tap a game to play five quick rounds and earn XP.
        </Text>
        <View style={styles.grid}>
          {CHILD_GAME_CATALOG.map((game) => (
            <Pressable
              key={game.id}
              accessibilityRole="button"
              accessibilityLabel={`Open ${game.title}`}
              onPress={() => navigation.navigate("GamePlay", { gameId: game.id, title: game.title })}
              style={({ pressed }) => [styles.gridItem, pressed && styles.cardPressed]}
            >
              <Card style={[styles.gameCard, { backgroundColor: game.color }, shadows.card]}>
                <Card.Content style={styles.cardInner}>
                  <Text style={styles.glyph}>{game.glyph}</Text>
                  <Text variant="titleMedium" style={styles.gameTitle}>
                    {game.title}
                  </Text>
                  <View style={styles.xpRow}>
                    <MaterialCommunityIcons name="star" size={14} color="#FFFDE7" />
                    <Text variant="labelSmall" style={styles.xp}>
                      +50 XP
                    </Text>
                  </View>
                  <View style={styles.playRow}>
                    <Text variant="labelSmall" style={styles.playText}>
                      Play
                    </Text>
                    <MaterialCommunityIcons name="chevron-right" size={18} color="#FFFDE7" />
                  </View>
                </Card.Content>
              </Card>
            </Pressable>
          ))}
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pad: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: "700",
  },
  hint: {
    color: colors.subtext,
    marginBottom: 12,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  gridItem: {
    width: "48%",
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  gameCard: {
    width: "100%",
    minHeight: 148,
    borderRadius: radii.md,
    justifyContent: "center",
  },
  cardInner: {
    alignItems: "center",
    gap: 6,
    minHeight: 120,
    justifyContent: "center",
  },
  glyph: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
  },
  gameTitle: {
    color: "#FFFFFF",
    fontWeight: "700",
    textAlign: "center",
  },
  xpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  xp: {
    color: "#FFFDE7",
  },
  playRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 2,
  },
  playText: {
    color: "#FFFDE7",
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
