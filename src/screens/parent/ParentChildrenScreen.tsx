import { StyleSheet } from "react-native";
import { Card, Divider, Text } from "react-native-paper";
import { ScreenContainer } from "@/components/ScreenContainer";
import { PrimaryButton } from "@/components/PrimaryButton";
import { colors } from "@/theme/theme";

export function ParentChildrenScreen() {
  return (
    <ScreenContainer scroll>
      <Text variant="headlineMedium" style={styles.title}>
        Manage Children
      </Text>

      <Card>
        <Card.Title title="Emma" subtitle="Age 6 - 245 stars" />
        <Card.Content style={styles.cardContent}>
          <Text>Daily Screen Limit: 2 hours</Text>
          <Divider />
          <Text>Learning Difficulty: Level 3</Text>
          <Divider />
          <Text>Bedtime: 8:00 PM - 7:00 AM</Text>
          <PrimaryButton label="Set Tasks" onPress={() => undefined} />
          <PrimaryButton label="Lock Device" onPress={() => undefined} mode="outlined" />
        </Card.Content>
      </Card>

      <Card>
        <Card.Title title="Liam" subtitle="Age 4 - 120 stars" />
        <Card.Content>
          <Text>Tap to configure profile details.</Text>
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
  cardContent: {
    gap: 10,
  },
});
