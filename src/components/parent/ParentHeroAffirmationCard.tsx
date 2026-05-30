import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Text } from "react-native-paper";
import { getDailyAffirmation } from "@/utils/parentDailyAffirmations";
import { useAppColors } from "@/theme/useAppColors";
import { radii } from "@/theme/theme";

export function ParentHeroAffirmationCard() {
  const affirmation = getDailyAffirmation();
  const appColors = useAppColors();

  return (
    <LinearGradient
      colors={[...appColors.heroGradient]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Guide your child through better learning habits.</Text>
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
