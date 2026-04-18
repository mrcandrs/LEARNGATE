import { StyleSheet, View } from "react-native";
import { Button, Card, Text } from "react-native-paper";
import { colors } from "@/theme/theme";

type TaskListItemProps = {
  title: string;
  subtitle: string;
  reward: string;
  actionLabel: string;
  onActionPress?: () => void;
  actionDisabled?: boolean;
};

export function TaskListItem({ title, subtitle, reward, actionLabel, onActionPress, actionDisabled }: TaskListItemProps) {
  return (
    <Card style={styles.card}>
      <Card.Content style={styles.content}>
        <View style={styles.leftBlock}>
          <Text variant="titleMedium" numberOfLines={1}>
            {title}
          </Text>
          <Text variant="bodySmall" style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
        <View style={styles.rightBlock}>
          <Text variant="bodyMedium" style={styles.reward}>
            {reward}
          </Text>
          {onActionPress ? (
            <Button mode="text" compact onPress={onActionPress} disabled={actionDisabled} labelStyle={styles.actionLabel}>
              {actionLabel}
            </Button>
          ) : (
            <Text variant="labelLarge" style={styles.actionLabel}>
              {actionLabel}
            </Text>
          )}
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
  },
  content: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  leftBlock: {
    flex: 1,
    minHeight: 56,
    justifyContent: "center",
  },
  rightBlock: {
    minWidth: 80,
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 2,
  },
  subtitle: {
    color: colors.subtext,
    marginTop: 4,
  },
  reward: {
    color: colors.warning,
    fontWeight: "700",
  },
  actionLabel: {
    color: colors.primaryDark,
  },
});
