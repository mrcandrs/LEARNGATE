import { Image, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { NotificationBell } from "@/components/NotificationBell";
import { radii, shadows } from "@/theme/theme";
import { levelToDifficultyLabel } from "@/utils/difficulty";

type Props = {
  name: string;
  level: number;
  stars: number;
  avatarUrl?: string | null;
  showNotifications?: boolean;
};

export function ChildDashboardHeader({ name, level, stars, avatarUrl, showNotifications = true }: Props) {
  const theme = useTheme();
  const difficultyLabel = levelToDifficultyLabel(level);

  return (
    <View style={[styles.outer, { backgroundColor: theme.colors.primary }]}>
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
                {difficultyLabel}
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
        {showNotifications ? <NotificationBell enabled variant="dashboard" /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderBottomLeftRadius: radii.lg,
    borderBottomRightRadius: radii.lg,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
    marginTop: -10,
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
});
