import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { useAppColors } from "@/theme/useAppColors";
import { radii } from "@/theme/theme";

type Props = {
  learning: number;
  exercise: number;
  chore: number;
};

export function CategoryBarChart({ learning, exercise, chore }: Props) {
  const c = useAppColors();
  const items = useMemo(
    () => [
      { key: "learning" as const, label: "Learning", color: c.info },
      { key: "exercise" as const, label: "Exercise", color: c.primary },
      { key: "chore" as const, label: "Chores", color: c.warning },
    ],
    [c]
  );
  const values = { learning, exercise, chore };
  const max = Math.max(learning, exercise, chore, 1);

  return (
    <View style={styles.wrap}>
      {items.map((item) => {
        const value = values[item.key];
        const widthPct = Math.max(8, Math.round((value / max) * 100));
        return (
          <View key={item.key} style={styles.row}>
            <Text variant="labelMedium" style={[styles.label, { color: c.subtext }]}>
              {item.label}
            </Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${widthPct}%`, backgroundColor: item.color }]} />
            </View>
            <Text variant="labelLarge" style={[styles.count, { color: c.text }]}>
              {value}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { width: 72 },
  track: {
    flex: 1,
    height: 10,
    backgroundColor: "#E5E7EB",
    borderRadius: radii.pill,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: radii.pill },
  count: { width: 24, textAlign: "right", fontWeight: "700" },
});
