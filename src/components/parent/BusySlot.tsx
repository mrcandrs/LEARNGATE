import { ActivityIndicator, StyleSheet, View, type ViewStyle } from "react-native";
import { colors } from "@/theme/theme";

type BusySlotProps = {
  busy: boolean;
  size?: "small" | "large";
  style?: ViewStyle;
};

/** Fixed-size slot so spinners never shift surrounding layout. */
export function BusySlot({ busy, size = "small", style }: BusySlotProps) {
  return (
    <View style={[styles.slot, style]} pointerEvents="none">
      {busy ? <ActivityIndicator size={size} color={colors.primary} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
