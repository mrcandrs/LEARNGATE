import { StyleSheet } from "react-native";
import { Card, Text } from "react-native-paper";
import { ScreenContainer } from "@/components/ScreenContainer";
import { colors } from "@/theme/theme";

export function ChildHomeScreen() {
  return (
    <ScreenContainer scroll>
      <Card style={styles.headerCard}>
        <Card.Content>
          <Text variant="headlineSmall" style={styles.headerTitle}>
            Hello, Emma!
          </Text>
          <Text variant="bodyMedium" style={styles.headerSub}>
            Level 3 • 245 stars • 2h left
          </Text>
        </Card.Content>
      </Card>

      <Card style={styles.streakCard}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.streakTitle}>
            7 Day Streak!
          </Text>
          <Text>You're on fire! Keep learning daily.</Text>
        </Card.Content>
      </Card>

      <Text variant="headlineSmall" style={styles.sectionTitle}>
        Today's Tasks
      </Text>
      <Card>
        <Card.Content style={styles.listBlock}>
          <Text>Read a Story</Text>
          <Text>Math Practice</Text>
          <Text>Color Quiz</Text>
        </Card.Content>
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    backgroundColor: colors.primary,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  headerSub: {
    color: "#EAFBEF",
    marginTop: 4,
  },
  streakCard: {
    backgroundColor: "#F5B614",
  },
  streakTitle: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: "700",
  },
  listBlock: {
    gap: 10,
  },
});
