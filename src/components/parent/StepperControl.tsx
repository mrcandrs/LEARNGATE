import { Pressable, StyleSheet, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "react-native-paper";
import { useAppColors } from "@/theme/useAppColors";
import { radii } from "@/theme/theme";

type StepperControlProps = {
  label: string;
  value: string;
  onDecrement: () => void;
  onIncrement: () => void;
  onValuePress?: () => void;
  decrementAccessibilityLabel?: string;
  incrementAccessibilityLabel?: string;
};

export function StepperControl({
  label,
  value,
  onDecrement,
  onIncrement,
  onValuePress,
  decrementAccessibilityLabel = "Decrease",
  incrementAccessibilityLabel = "Increase",
}: StepperControlProps) {
  const c = useAppColors();

  return (
    <View style={styles.block}>
      <Text variant="labelLarge" style={[styles.label, { color: c.text }]}>
        {label}
      </Text>
      <View style={styles.row}>
        <Pressable
          onPress={onDecrement}
          style={[styles.stepButton, { borderColor: c.border, backgroundColor: c.stepperButtonBg }]}
          accessibilityRole="button"
          accessibilityLabel={decrementAccessibilityLabel}
        >
          <MaterialCommunityIcons name="chevron-left" size={22} color={c.text} />
        </Pressable>
        <Pressable
          onPress={onValuePress}
          disabled={!onValuePress}
          style={[styles.valuePill, { backgroundColor: c.stepperValueBg }]}
          accessibilityRole="button"
          accessibilityLabel={onValuePress ? `${label}, ${value}. Tap to set.` : undefined}
        >
          <Text variant="titleSmall" style={[styles.valueText, { color: c.primaryDark }]}>
            {value}
          </Text>
        </Pressable>
        <Pressable
          onPress={onIncrement}
          style={[styles.stepButton, { borderColor: c.border, backgroundColor: c.stepperButtonBg }]}
          accessibilityRole="button"
          accessibilityLabel={incrementAccessibilityLabel}
        >
          <MaterialCommunityIcons name="chevron-right" size={22} color={c.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 8,
  },
  label: {
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepButton: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  valuePill: {
    flex: 1,
    minHeight: 44,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  valueText: {
    fontWeight: "700",
    textAlign: "center",
  },
});
