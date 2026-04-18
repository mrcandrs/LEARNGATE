import { StyleSheet, View } from "react-native";
import { Card, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { colors, radii, shadows } from "@/theme/theme";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

type StatCardProps = {
  label: string;
  value: string;
  iconName?: IconName;
  iconColor?: string;
};

export function StatCard({ label, value, iconName, iconColor = colors.primary }: StatCardProps) {
  return (
    <Card style={styles.card}>
      <Card.Content style={styles.inner}>
        {iconName ? (
          <View style={[styles.iconCircle, { backgroundColor: `${iconColor}18` }]}>
            <MaterialCommunityIcons name={iconName} size={20} color={iconColor} />
          </View>
        ) : null}
        <Text variant="headlineSmall" style={styles.value}>
          {value}
        </Text>
        <Text variant="bodyMedium" style={styles.label}>
          {label}
        </Text>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    ...shadows.card,
  },
  inner: {
    gap: 6,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  value: {
    color: colors.text,
    fontWeight: "700",
  },
  label: {
    color: colors.subtext,
  },
});
