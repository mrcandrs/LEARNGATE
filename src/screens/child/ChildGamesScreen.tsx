import { StyleSheet, View } from "react-native";
import { Card, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ChildDashboardHeader } from "@/components/ChildDashboardHeader";
import { colors, radii, shadows } from "@/theme/theme";
import { useChildProfile } from "@/hooks/useChildProfile";

const games: { title: string; glyph: string; color: string }[] = [
  { title: "Alphabet Adventure", glyph: "ABC", color: "#2196F3" },
  { title: "Number Train", glyph: "#", color: "#4CAF50" },
  { title: "Color Factory", glyph: "Art", color: "#FF9800" },
  { title: "Shape Match", glyph: "◇", color: "#9C27B0" },
  { title: "Math Challenge", glyph: "+−", color: "#F44336" },
  { title: "Science Lab", glyph: "Lab", color: "#009688" },
];

export function ChildGamesScreen() {
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
        <Text variant="titleLarge" style={styles.sectionTitle}>
          Games
        </Text>
        <View style={styles.grid}>
          {games.map((game) => (
            <Card key={game.title} style={[styles.gameCard, { backgroundColor: game.color }, shadows.card]}>
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
              </Card.Content>
            </Card>
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
  sectionTitle: {
    color: colors.text,
    fontWeight: "700",
    marginBottom: 8,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  gameCard: {
    width: "48%",
    minHeight: 140,
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
});
