import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { AchievementProgress } from "@/services/childAchievements";
import { useAppColors } from "@/theme/useAppColors";
import { radii } from "@/theme/theme";

type Props = {
  item: AchievementProgress;
  claimed?: boolean;
  claiming?: boolean;
  onClaim?: () => void;
};

export function AchievementBadgeCard({ item, claimed = false, claiming = false, onClaim }: Props) {
  const c = useAppColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const { definition, unlocked, progress } = item;
  const pct =
    progress && progress.target > 0
      ? Math.round((progress.current / progress.target) * 100)
      : unlocked
        ? 100
        : 0;

  const canClaim = unlocked && !claimed && definition.bonusStars > 0;

  return (
    <View style={[styles.card, unlocked ? styles.cardUnlocked : styles.cardLocked]}>
      <View style={[styles.iconWrap, unlocked ? styles.iconUnlocked : styles.iconLocked]}>
        <MaterialCommunityIcons
          name={unlocked ? definition.icon : "lock"}
          size={24}
          color={unlocked ? c.primaryDark : c.subtext}
        />
      </View>
      <Text variant="labelMedium" style={[styles.title, !unlocked && styles.titleLocked]} numberOfLines={2}>
        {definition.title}
      </Text>
      <Text variant="labelSmall" style={styles.description} numberOfLines={2}>
        {definition.description}
      </Text>
      {definition.bonusStars > 0 ? (
        <Text variant="labelSmall" style={styles.rewardHint}>
          Reward: +{definition.bonusStars} stars
        </Text>
      ) : null}
      {!unlocked && progress ? (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.min(pct, 100)}%` }]} />
        </View>
      ) : null}
      {canClaim && onClaim ? (
        <Button
          mode="contained"
          compact
          loading={claiming}
          disabled={claiming}
          onPress={onClaim}
          style={styles.claimBtn}
          labelStyle={styles.claimLabel}
        >
          Claim
        </Button>
      ) : (
        <Text variant="labelSmall" style={styles.progressLabel}>
          {unlocked
            ? claimed
              ? "Claimed"
              : definition.bonusStars > 0
                ? "Unlocked"
                : "Unlocked"
            : progress
              ? `${progress.current}/${progress.target}`
              : "Locked"}
        </Text>
      )}
    </View>
  );
}

function createStyles(c: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    card: {
      width: "47%",
      borderRadius: radii.md,
      padding: 12,
      alignItems: "center",
      gap: 6,
      borderWidth: 1,
    },
    cardUnlocked: {
      backgroundColor: c.surfaceTint,
      borderColor: c.surfaceTintBorder,
    },
    cardLocked: {
      backgroundColor: c.mutedSurface,
      borderColor: c.border,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    iconUnlocked: {
      backgroundColor: c.progressTrack,
    },
    iconLocked: {
      backgroundColor: c.border,
    },
    title: {
      fontWeight: "700",
      color: c.text,
      textAlign: "center",
    },
    titleLocked: {
      color: c.subtext,
    },
    description: {
      color: c.subtext,
      textAlign: "center",
      lineHeight: 16,
    },
    rewardHint: {
      color: c.warning,
      fontWeight: "700",
      textAlign: "center",
    },
    progressTrack: {
      width: "100%",
      height: 6,
      backgroundColor: c.progressTrack,
      borderRadius: radii.pill,
      overflow: "hidden",
      marginTop: 2,
    },
    progressFill: {
      height: "100%",
      backgroundColor: c.primary,
      borderRadius: radii.pill,
    },
    progressLabel: {
      color: c.subtext,
      fontWeight: "600",
    },
    claimBtn: {
      marginTop: 2,
      alignSelf: "stretch",
    },
    claimLabel: {
      fontSize: 12,
      marginVertical: 2,
    },
  });
}
