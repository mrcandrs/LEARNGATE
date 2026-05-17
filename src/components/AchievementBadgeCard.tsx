import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { AchievementProgress } from "@/services/childAchievements";
import { colors, radii } from "@/theme/theme";

type Props = {
  item: AchievementProgress;
};

export function AchievementBadgeCard({ item }: Props) {
  const { definition, unlocked, progress } = item;
  const pct =
    progress && progress.target > 0
      ? Math.round((progress.current / progress.target) * 100)
      : unlocked
        ? 100
        : 0;

  return (
    <View style={[styles.card, unlocked ? styles.cardUnlocked : styles.cardLocked]}>
      <View style={[styles.iconWrap, unlocked ? styles.iconUnlocked : styles.iconLocked]}>
        <MaterialCommunityIcons
          name={unlocked ? definition.icon : "lock"}
          size={24}
          color={unlocked ? colors.primaryDark : colors.subtext}
        />
      </View>
      <Text variant="labelMedium" style={[styles.title, !unlocked && styles.titleLocked]} numberOfLines={2}>
        {definition.title}
      </Text>
      <Text variant="labelSmall" style={styles.description} numberOfLines={2}>
        {definition.description}
      </Text>
      {!unlocked && progress ? (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.min(pct, 100)}%` }]} />
        </View>
      ) : null}
      <Text variant="labelSmall" style={styles.progressLabel}>
        {unlocked
          ? "Unlocked"
          : progress
            ? `${progress.current}/${progress.target}`
            : "Locked"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "47%",
    borderRadius: radii.md,
    padding: 12,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
  },
  cardUnlocked: {
    backgroundColor: "#ECFDF5",
    borderColor: "#86EFAC",
  },
  cardLocked: {
    backgroundColor: "#F9FAFB",
    borderColor: colors.border,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  iconUnlocked: {
    backgroundColor: "#DCFCE7",
  },
  iconLocked: {
    backgroundColor: "#E5E7EB",
  },
  title: {
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  titleLocked: {
    color: colors.subtext,
  },
  description: {
    color: colors.subtext,
    textAlign: "center",
    lineHeight: 16,
  },
  progressTrack: {
    width: "100%",
    height: 6,
    backgroundColor: "#E5E7EB",
    borderRadius: radii.pill,
    overflow: "hidden",
    marginTop: 2,
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
  },
  progressLabel: {
    color: colors.subtext,
    fontWeight: "600",
  },
});
