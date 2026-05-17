import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { colors, radii } from "@/theme/theme";

type Props = {
  learning: number;
  exercise: number;
  chore: number;
};

const ITEMS = [
  { key: "learning" as const, label: "Learning", color: colors.info },
  { key: "exercise" as const, label: "Exercise", color: colors.primary },
  { key: "chore" as const, label: "Chores", color: colors.warning },
];

export function CategoryBarChart({ learning, exercise, chore }: Props) {
  const values = { learning, exercise, chore };
  const max = Math.max(learning, exercise, chore, 1);

  return (
    <View style={styles.wrap}>
      {ITEMS.map((item) => {
        const value = values[item.key];
        const widthPct = Math.max(8, Math.round((value / max) * 100));
        return (
          <View key={item.key} style={styles.row}>
            <Text variant="labelMedium" style={styles.label}>
              {item.label}
            </Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${widthPct}%`, backgroundColor: item.color }]} />
            </View>
            <Text variant="labelLarge" style={styles.count}>
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
  label: { width: 72, color: colors.subtext },
  track: {
    flex: 1,
    height: 10,
    backgroundColor: "#E5E7EB",
    borderRadius: radii.pill,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: radii.pill },
  count: { width: 24, textAlign: "right", fontWeight: "700", color: colors.text },
});
