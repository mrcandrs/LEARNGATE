import { Image, Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { NotificationBell } from "@/components/NotificationBell";
import { useAppColors } from "@/theme/useAppColors";
import { radii, shadows } from "@/theme/theme";
import { levelToDifficultyLabel } from "@/utils/difficulty";

type Props = {
  name: string;
  level: number;
  stars: number;
  avatarUrl?: string | null;
  showNotifications?: boolean;
  onAvatarPress?: () => void;
  subtitle?: string;
};

export function ChildDashboardHeader({
  name,
  level,
  stars,
  avatarUrl,
  showNotifications = true,
  onAvatarPress,
  subtitle = "Let's learn, play, and grow today.",
}: Props) {
  const c = useAppColors();
  const insets = useSafeAreaInsets();
  const difficultyLabel = levelToDifficultyLabel(level);

  return (
    <LinearGradient
      colors={[...c.heroGradient]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.outer, { paddingTop: insets.top + 12 }]}
    >
      <View style={styles.row}>
        <Pressable
          onPress={onAvatarPress}
          disabled={!onAvatarPress}
          accessibilityRole="button"
          accessibilityLabel="Open profile and settings"
          style={styles.avatarBtn}
        >
          <View style={styles.avatarWrap}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
            ) : (
              <MaterialCommunityIcons name="account-circle" size={48} color="#FFF8E7" />
            )}
          </View>
        </Pressable>
        <View style={styles.textBlock}>
          <Text variant="titleLarge" style={styles.greeting}>
            Hello, {name}!
          </Text>
          <Text variant="bodySmall" style={styles.subtitle}>
            {subtitle}
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderBottomLeftRadius: radii.lg,
    borderBottomRightRadius: radii.lg,
    paddingHorizontal: 16,
    paddingBottom: 18,
    marginBottom: 8,
    ...shadows.card,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarBtn: {
    borderRadius: 28,
  },
  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
  },
  avatarImg: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  greeting: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  subtitle: {
    color: "rgba(255,255,255,0.92)",
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.18)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  pillText: {
    color: "#F9FAFB",
    fontWeight: "600",
  },
});
