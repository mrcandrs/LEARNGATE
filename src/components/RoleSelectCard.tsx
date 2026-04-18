import type { ComponentProps } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, radii, shadows } from "@/theme/theme";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

type Props = {
  title: string;
  description: string;
  iconName: IconName;
  iconColor: string;
  onPress: () => void;
};

export function RoleSelectCard({ title, description, iconName, iconColor, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={[styles.iconCircle, { borderColor: iconColor }]}>
        <MaterialCommunityIcons name={iconName} size={28} color={iconColor} />
      </View>
      <View style={styles.textCol}>
        <Text variant="titleMedium" style={styles.title}>
          {title}
        </Text>
        <Text variant="bodySmall" style={styles.desc}>
          {description}
        </Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={24} color={colors.border} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  pressed: {
    opacity: 0.92,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontWeight: "700",
    color: colors.text,
  },
  desc: {
    color: colors.subtext,
    marginTop: 4,
  },
});
