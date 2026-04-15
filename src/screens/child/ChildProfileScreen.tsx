import { StyleSheet } from "react-native";
import { Card, Text } from "react-native-paper";
import { ScreenContainer } from "@/components/ScreenContainer";
import { colors } from "@/theme/theme";

export function ChildProfileScreen() {
  return (
    <ScreenContainer scroll>
      <Text variant="headlineMedium" style={styles.title}>
        Emma Johnson
      </Text>
      <Text variant="bodyLarge" style={styles.subtitle}>
        Age 6 - Level 3
      </Text>

      <Card>
        <Card.Title title="Learning Stats" />
        <Card.Content style={styles.statsList}>
          <Text>Total Learning Time: 48 hours</Text>
          <Text>Tasks Completed: 156</Text>
          <Text>Games Played: 89</Text>
          <Text>Stars Earned: 245</Text>
        </Card.Content>
      </Card>

      <Card>
        <Card.Title title="Achievements" />
        <Card.Content style={styles.statsList}>
          <Text>First Star</Text>
          <Text>7 Day Streak</Text>
          <Text>Math Master</Text>
          <Text>Reading Champ</Text>
        </Card.Content>
      </Card>
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
});
