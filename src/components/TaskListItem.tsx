import { useMemo } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Button, Card, Text } from "react-native-paper";
import { useAppColors } from "@/theme/useAppColors";

type TaskListItemProps = {
  title: string;
  subtitle: string;
  reward: string;
  actionLabel: string;
  onActionPress?: () => void;
  actionDisabled?: boolean;
  actionLoading?: boolean;
};

export function TaskListItem({
  title,
  subtitle,
  reward,
  actionLabel,
  onActionPress,
  actionDisabled,
  actionLoading,
}: TaskListItemProps) {
  const c = useAppColors();
  const styles = useMemo(() => createStyles(c), [c]);

  return (
    <Card style={styles.card}>
      <Card.Content style={styles.content}>
        <View style={styles.leftBlock}>
          <Text variant="titleMedium" style={styles.title} numberOfLines={1}>
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
            actionLoading ? (
              <ActivityIndicator size="small" color={c.primaryDark} />
            ) : (
              <Button mode="text" compact onPress={onActionPress} disabled={actionDisabled} labelStyle={styles.actionLabel}>
                {actionLabel}
              </Button>
            )
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

function createStyles(c: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.card,
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
    title: {
      color: c.text,
    },
    subtitle: {
      color: c.subtext,
      marginTop: 4,
    },
    reward: {
      color: c.warning,
      fontWeight: "700",
    },
    actionLabel: {
      color: c.primaryDark,
    },
  });
}
