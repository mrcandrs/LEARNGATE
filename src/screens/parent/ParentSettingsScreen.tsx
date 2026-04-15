import { StyleSheet } from "react-native";
import { Card, Divider, Text } from "react-native-paper";
import { ScreenContainer } from "@/components/ScreenContainer";
import { colors } from "@/theme/theme";

export function ParentSettingsScreen() {
  return (
    <ScreenContainer scroll>
      <Text variant="headlineMedium" style={styles.title}>
        Parent Settings
      </Text>

      <Card>
        <Card.Title title="Screen Time Controls" />
        <Card.Content style={styles.block}>
          <Text>Daily Time Limit: 2 hours</Text>
          <Divider />
          <Text>Bedtime Schedule: 8:00 PM - 7:00 AM</Text>
          <Divider />
          <Text>App Blocking: 3 apps blocked</Text>
        </Card.Content>
      </Card>

      <Card>
        <Card.Title title="Learning Settings" />
        <Card.Content style={styles.block}>
          <Text>Default Difficulty: Intermediate</Text>
          <Divider />
          <Text>Task Requirements: 3 tasks</Text>
          <Divider />
          <Text>Reward Multiplier: 1.5x</Text>
        </Card.Content>
      </Card>

      <Card>
        <Card.Title title="Notifications" />
        <Card.Content style={styles.block}>
          <Text>Daily Report: On</Text>
          <Divider />
          <Text>Task Reminders: On</Text>
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
  block: {
    gap: 10,
  },
});
