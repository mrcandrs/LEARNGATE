import { StyleSheet, View } from "react-native";
import { Card, Text } from "react-native-paper";
import { ScreenContainer } from "@/components/ScreenContainer";
import { colors } from "@/theme/theme";

const games = [
  "Alphabet Adventure",
  "Number Train",
  "Color Factory",
  "Shape Match",
  "Math Challenge",
  "Science Lab",
];

export function ChildGamesScreen() {
  return (
    <ScreenContainer scroll>
      <Text variant="headlineMedium" style={styles.title}>
        Games
      </Text>
      <View style={styles.grid}>
        {games.map((game) => (
          <Card key={game} style={styles.gameCard}>
            <Card.Content>
              <Text variant="titleMedium">{game}</Text>
              <Text variant="bodySmall" style={styles.reward}>
                +50 XP
              </Text>
            </Card.Content>
          </Card>
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontWeight: "700",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  gameCard: {
    width: "48%",
    minHeight: 120,
    justifyContent: "center",
  },
  reward: {
    marginTop: 8,
    color: colors.subtext,
  },
});
