import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppColors } from "@/theme/useAppColors";
import { radii } from "@/theme/theme";

type Props = {
  message: string;
};

/** Soft info banner for offline / cached data (not a hard error). */
export const OfflineNoticeBanner = memo(function OfflineNoticeBanner({ message }: Props) {
  const c = useAppColors();
  return (
    <View
      style={[styles.wrap, { backgroundColor: c.surfaceTint, borderColor: c.surfaceTintBorder }]}
      accessibilityRole="text"
      accessibilityLabel={message}
    >
      <MaterialCommunityIcons name="cloud-off-outline" size={22} color={c.primaryDark} />
      <Text variant="bodySmall" style={[styles.text, { color: c.text }]}>
        {message}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  text: {
    flex: 1,
    fontWeight: "600",
    lineHeight: 18,
  },
});
