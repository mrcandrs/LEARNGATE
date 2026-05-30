import { StyleSheet, View } from "react-native";
import { Card, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useAppColors } from "@/theme/useAppColors";
import { radii, shadows } from "@/theme/theme";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

type StatCardProps = {
  label: string;
  value: string;
  iconName?: IconName;
  iconColor?: string;
};

export function StatCard({ label, value, iconName, iconColor }: StatCardProps) {
  const c = useAppColors();
  const resolvedIconColor = iconColor ?? c.primary;

  return (
    <Card style={[styles.card, { backgroundColor: c.mutedSurface }]}>
      <Card.Content style={styles.inner}>
        {iconName ? (
          <View style={[styles.iconCircle, { backgroundColor: `${resolvedIconColor}18` }]}>
            <MaterialCommunityIcons name={iconName} size={20} color={resolvedIconColor} />
          </View>
        ) : null}
        <Text variant="headlineSmall" style={[styles.value, { color: c.text }]}>
          {value}
        </Text>
        <Text variant="bodyMedium" style={[styles.label, { color: c.subtext }]}>
          {label}
        </Text>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
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
    fontWeight: "700",
  },
  label: {},
});
