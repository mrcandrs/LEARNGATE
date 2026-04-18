import { Image, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii, shadows } from "@/theme/theme";

type Props = {
  name: string;
  level: number;
  stars: number;
  dailyLimitMinutes: number;
  avatarUrl?: string | null;
};

export function ChildDashboardHeader({ name, level, stars, dailyLimitMinutes, avatarUrl }: Props) {
  const insets = useSafeAreaInsets();
  const hoursLeft = Math.max(1, Math.round(dailyLimitMinutes / 60));

  return (
    <View style={[styles.outer, { paddingTop: insets.top + 8, marginHorizontal: -16, marginTop: -16 }]}>
      <View style={styles.row}>
        <View style={styles.avatarWrap}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
          ) : (
            <MaterialCommunityIcons name="account-circle" size={48} color="#FFF8E7" />
          )}
        </View>
        <View style={styles.textBlock}>
          <Text variant="titleLarge" style={styles.greeting}>
            Hello, {name}!
          </Text>
          <View style={styles.metaRow}>
            <View style={styles.pill}>
              <Text variant="labelMedium" style={styles.pillText}>
                Level {level}
              </Text>
            </View>
            <View style={styles.pill}>
              <MaterialCommunityIcons name="star" size={14} color="#FBBF24" />
              <Text variant="labelMedium" style={styles.pillText}>
                {stars}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.timePill}>
          <MaterialCommunityIcons name="timer-outline" size={16} color="#E5E7EB" />
          <Text variant="labelSmall" style={styles.timeText}>
            {hoursLeft}h left
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    backgroundColor: colors.primary,
    borderBottomLeftRadius: radii.lg,
    borderBottomRightRadius: radii.lg,
    paddingHorizontal: 16,
    paddingBottom: 16,
    marginBottom: 8,
    ...shadows.card,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  greeting: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  pillText: {
    color: "#F9FAFB",
  },
  timePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  timeText: {
    color: "#F3F4F6",
    fontWeight: "600",
  },
});
