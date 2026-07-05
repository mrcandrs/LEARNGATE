import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { AchievementLadderProgress, LadderTierProgress } from "@/services/childAchievements";
import { useAppColors } from "@/theme/useAppColors";
import { radii } from "@/theme/theme";

type Props = {
  ladder: AchievementLadderProgress;
  isClaimed: (achievementId: string) => boolean;
  claimingId: string | null;
  onClaim?: (tier: LadderTierProgress) => void;
};

export function AchievementLadderCard({ ladder, isClaimed, claimingId, onClaim }: Props) {
  const c = useAppColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const { ladder: def, currentValue, tiers, unlockedCount } = ladder;
  const formatValue = def.formatValue ?? ((v: number) => String(v));
  const allUnlocked = unlockedCount >= tiers.length;

  const claimableTier = tiers.find(
    (t) => t.unlocked && !isClaimed(t.definition.id) && t.definition.bonusStars > 0
  );

  return (
    <View style={[styles.card, allUnlocked && styles.cardComplete]}>
      <View style={styles.headerRow}>
        <View style={[styles.iconWrap, unlockedCount > 0 && styles.iconActive]}>
          <MaterialCommunityIcons name={def.icon} size={26} color={unlockedCount > 0 ? c.primaryDark : c.subtext} />
        </View>
        <View style={styles.headerText}>
          <Text variant="titleSmall" style={styles.title}>
            {def.title}
          </Text>
          <Text variant="bodySmall" style={styles.description}>
            {def.description}
          </Text>
        </View>
        <View style={styles.countPill}>
          <Text variant="labelSmall" style={styles.countText}>
            {unlockedCount}/{tiers.length}
          </Text>
        </View>
      </View>

      <View style={styles.stepBarWrap}>
        <View style={styles.stepTrack}>
          <View
            style={[
              styles.stepFill,
              {
                width: `${Math.min(100, Math.max(0, computeBarFillPercent(ladder)))}%`,
              },
            ]}
          />
        </View>
        <View style={styles.stepsRow}>
          {tiers.map((tier) => {
            const unlocked = tier.unlocked;
            const claimed = isClaimed(tier.definition.id);
            const isCurrent = !unlocked && ladder.nextTier?.definition.id === tier.definition.id;
            return (
              <View key={tier.definition.id} style={styles.stepCol}>
                <View
                  style={[
                    styles.stepDot,
                    unlocked && styles.stepDotUnlocked,
                    isCurrent && styles.stepDotCurrent,
                    claimed && styles.stepDotClaimed,
                  ]}
                >
                  {unlocked ? (
                    <MaterialCommunityIcons
                      name={claimed ? "check" : "star-four-points"}
                      size={10}
                      color={claimed ? c.primaryDark : "#FFFFFF"}
                    />
                  ) : (
                    <View style={styles.stepDotInner} />
                  )}
                </View>
                <Text
                  variant="labelSmall"
                  style={[
                    styles.stepLabel,
                    unlocked && styles.stepLabelUnlocked,
                    isCurrent && styles.stepLabelCurrent,
                  ]}
                  numberOfLines={1}
                >
                  {tier.definition.stepLabel}
                </Text>
                {tier.definition.bonusStars > 0 ? (
                  <Text variant="labelSmall" style={styles.stepBonus} numberOfLines={1}>
                    +{tier.definition.bonusStars}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.footerRow}>
        <Text variant="labelMedium" style={styles.currentValue}>
          {formatValue(currentValue)}
        </Text>
        {ladder.nextTier ? (
          <Text variant="labelSmall" style={styles.nextHint}>
            Next: {ladder.nextTier.progress.current}/{ladder.nextTier.progress.target}
          </Text>
        ) : (
          <Text variant="labelSmall" style={styles.nextHintComplete}>
            All steps complete!
          </Text>
        )}
      </View>

      {claimableTier && onClaim ? (
        <Button
          mode="contained"
          compact
          loading={claimingId === claimableTier.definition.id}
          disabled={claimingId != null}
          onPress={() => onClaim(claimableTier)}
          style={styles.claimBtn}
          labelStyle={styles.claimLabel}
        >
          Claim +{claimableTier.definition.bonusStars} stars ({claimableTier.definition.stepLabel})
        </Button>
      ) : null}
    </View>
  );
}

/** Fill the track based on position between ladder tier targets. */
function computeBarFillPercent(ladder: AchievementLadderProgress): number {
  const tiers = ladder.ladder.tiers;
  if (tiers.length === 0) {
    return 0;
  }
  if (tiers.length === 1) {
    const t = tiers[0].target;
    return t > 0 ? (Math.min(ladder.currentValue, t) / t) * 100 : 0;
  }

  const maxIndex = tiers.length - 1;
  const value = ladder.currentValue;

  if (value >= tiers[maxIndex].target) {
    return 100;
  }

  for (let i = 0; i < tiers.length; i++) {
    const target = tiers[i].target;
    const prevTarget = i === 0 ? 0 : tiers[i - 1].target;
    if (value < target) {
      const segmentStart = i / maxIndex;
      const segmentWidth = 1 / maxIndex;
      const segmentPct = target > prevTarget ? (value - prevTarget) / (target - prevTarget) : 0;
      return (segmentStart + segmentPct * segmentWidth) * 100;
    }
  }
  return 100;
}

function createStyles(c: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    card: {
      borderRadius: radii.md,
      padding: 14,
      gap: 12,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
    },
    cardComplete: {
      borderColor: c.surfaceTintBorder,
      backgroundColor: c.surfaceTint,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.mutedSurface,
    },
    iconActive: {
      backgroundColor: c.progressTrack,
    },
    headerText: {
      flex: 1,
      gap: 4,
    },
    title: {
      fontWeight: "800",
      color: c.text,
    },
    description: {
      color: c.subtext,
      lineHeight: 18,
    },
    countPill: {
      backgroundColor: c.mutedSurface,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radii.pill,
    },
    countText: {
      fontWeight: "700",
      color: c.primaryDark,
    },
    stepBarWrap: {
      gap: 6,
    },
    stepTrack: {
      height: 6,
      backgroundColor: c.progressTrack,
      borderRadius: radii.pill,
      overflow: "hidden",
    },
    stepFill: {
      height: "100%",
      backgroundColor: c.primary,
      borderRadius: radii.pill,
    },
    stepsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    stepCol: {
      flex: 1,
      alignItems: "center",
      gap: 2,
      minWidth: 0,
    },
    stepDot: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: c.border,
      backgroundColor: c.mutedSurface,
      alignItems: "center",
      justifyContent: "center",
    },
    stepDotUnlocked: {
      borderColor: c.primary,
      backgroundColor: c.primary,
    },
    stepDotCurrent: {
      borderColor: c.primaryDark,
      backgroundColor: c.card,
    },
    stepDotClaimed: {
      borderColor: c.primaryDark,
      backgroundColor: c.progressTrack,
    },
    stepDotInner: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: c.subtext,
    },
    stepLabel: {
      color: c.subtext,
      fontWeight: "600",
      fontSize: 10,
    },
    stepLabelUnlocked: {
      color: c.primaryDark,
    },
    stepLabelCurrent: {
      color: c.text,
      fontWeight: "800",
    },
    stepBonus: {
      color: c.warning,
      fontWeight: "700",
      fontSize: 9,
    },
    footerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    currentValue: {
      fontWeight: "700",
      color: c.text,
    },
    nextHint: {
      color: c.subtext,
    },
    nextHintComplete: {
      color: c.primaryDark,
      fontWeight: "700",
    },
    claimBtn: {
      alignSelf: "stretch",
    },
    claimLabel: {
      fontSize: 12,
      marginVertical: 2,
    },
  });
}
