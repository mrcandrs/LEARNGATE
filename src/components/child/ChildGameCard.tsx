import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ResolvedChildGame } from "@/data/childGames";
import { radii, shadows } from "@/theme/theme";

type Props = {
  game: ResolvedChildGame;
  compact?: boolean;
  footerNote?: string;
};

export function ChildGameCard({ game, compact = false, footerNote = "10 questions" }: Props) {
  return (
    <View style={[styles.card, { backgroundColor: game.color }, compact && styles.cardCompact]}>
      <View style={styles.deco} />
      {game.badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{game.badge}</Text>
        </View>
      ) : null}
      <View style={styles.topRow}>
        <Text style={styles.glyph}>{game.glyph}</Text>
        <MaterialCommunityIcons name={game.icon} size={compact ? 22 : 26} color="rgba(255,255,255,0.95)" />
      </View>
      <Text style={styles.teaser}>{game.teaser}</Text>
      <Text style={styles.name}>{game.title}</Text>
      <Text style={styles.blurb} numberOfLines={2}>
        {game.blurb}
      </Text>
      <View style={styles.footer}>
        <MaterialCommunityIcons name="star" size={14} color="#FFFDE7" />
        <Text style={styles.footerText}>{footerNote}</Text>
      </View>
      <Text style={styles.playLink}>{game.playCta} ›</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.md,
    padding: 14,
    height: 196,
    overflow: "hidden",
    justifyContent: "space-between",
    ...shadows.card,
  },
  cardCompact: {
    height: 168,
    padding: 12,
  },
  deco: {
    position: "absolute",
    top: -24,
    right: -24,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,0,0,0.22)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: 2,
  },
  glyph: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "800",
    lineHeight: 30,
  },
  teaser: {
    color: "rgba(255,255,255,0.95)",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  name: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 16,
    marginTop: 2,
  },
  blurb: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  footerText: {
    color: "#FFFDE7",
    fontSize: 12,
    fontWeight: "600",
  },
  playLink: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 13,
    marginTop: 4,
  },
});
