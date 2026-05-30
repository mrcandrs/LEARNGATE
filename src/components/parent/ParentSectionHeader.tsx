import type { ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "react-native-paper";
import { useAppColors } from "@/theme/useAppColors";
import { radii } from "@/theme/theme";

type ParentSectionHeaderProps = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  subtitle?: string;
  iconColor?: string;
  iconBackground?: string;
  right?: ReactNode;
  style?: ViewStyle;
};

export function ParentSectionHeader({
  icon,
  title,
  subtitle,
  iconColor,
  iconBackground,
  right,
  style,
}: ParentSectionHeaderProps) {
  const c = useAppColors();

  return (
    <View style={[styles.row, style]}>
      <View style={[styles.iconWrap, { backgroundColor: iconBackground ?? c.sectionIconBg }]}>
        <MaterialCommunityIcons name={icon} size={22} color={iconColor ?? c.primaryDark} />
      </View>
      <View style={styles.textWrap}>
        <Text variant="titleMedium" style={[styles.title, { color: c.primaryDark }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodySmall" style={[styles.subtitle, { color: c.subtext }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: {
    flex: 1,
    gap: 2,
    paddingTop: 2,
  },
  title: {
    fontWeight: "800",
    lineHeight: 22,
  },
  subtitle: {
    lineHeight: 18,
  },
});
