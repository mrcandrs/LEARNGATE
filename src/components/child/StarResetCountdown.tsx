import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useStarResetCountdown } from "@/hooks/useStarResetCountdown";

type Props = {
  variant?: "header" | "card";
  subtextColor?: string;
};

export function StarResetCountdown({ variant = "header", subtextColor }: Props) {
  const countdown = useStarResetCountdown();
  const isHeader = variant === "header";

  return (
    <View style={[styles.wrap, isHeader ? styles.headerWrap : styles.cardWrap]}>
      <MaterialCommunityIcons
        name="timer-sand"
        size={isHeader ? 13 : 16}
        color={isHeader ? "rgba(255,255,255,0.9)" : subtextColor}
      />
      <Text
        style={[
          styles.text,
          isHeader ? styles.headerText : styles.cardText,
          !isHeader && subtextColor ? { color: subtextColor } : null,
        ]}
      >
        Stars reset in {countdown}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headerWrap: {
    marginTop: 4,
  },
  cardWrap: {
    paddingVertical: 2,
  },
  text: {
    fontWeight: "600",
  },
  headerText: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 12,
  },
  cardText: {
    fontSize: 13,
  },
});
