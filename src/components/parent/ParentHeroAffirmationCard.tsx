import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Text } from "react-native-paper";
import { radii } from "@/theme/theme";
import { useAppColors } from "@/theme/useAppColors";
import { useLocale } from "@/store/LocaleContext";
import { getDailyAffirmation } from "@/utils/parentDailyAffirmations";

export function ParentHeroAffirmationCard() {
  const { t, locale } = useLocale();
  const affirmation = getDailyAffirmation(locale);
  const appColors = useAppColors();

  return (
    <LinearGradient
      colors={[...appColors.heroGradient]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.content}>
        <Text style={styles.title}>{t("parent.hero.title")}</Text>
        <Text style={styles.affirmation}>{affirmation}</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    padding: 18,
    minHeight: 140,
    overflow: "hidden",
  },
  content: {
    gap: 10,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
  },
  affirmation: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 14,
    lineHeight: 20,
    fontStyle: "italic",
  },
});
