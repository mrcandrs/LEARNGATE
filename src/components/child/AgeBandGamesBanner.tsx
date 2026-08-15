import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import type { AgeBandDefinition } from "@/data/childAgeBands";
import { radii } from "@/theme/theme";
import { useLocale } from "@/store/LocaleContext";
import { localizedAgeBand } from "@/i18n/helpers";

type Props = {
  band: AgeBandDefinition;
  childAge?: number;
};

export function AgeBandGamesBanner({ band, childAge }: Props) {
  const { t } = useLocale();
  const copy = localizedAgeBand(band.id, t);
  return (
    <View style={styles.wrap}>
      <Text style={styles.emoji}>{band.emoji}</Text>
      <View style={styles.text}>
        <Text style={styles.title}>{copy.heroTitle}</Text>
        <Text style={styles.subtitle}>{copy.heroSubtitle}</Text>
        {typeof childAge === "number" ? (
          <View style={styles.pill}>
            <Text style={styles.pillText}>
              {t("ageBands.ageLine", { label: copy.label, age: childAge, shortLabel: copy.shortLabel })}
            </Text>
          </View>
        ) : (
          <View style={styles.pill}>
            <Text style={styles.pillText}>{t("ageBands.bandLine", { label: copy.label, shortLabel: copy.shortLabel })}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: radii.md,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  emoji: {
    fontSize: 32,
    lineHeight: 36,
  },
  text: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  subtitle: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 14,
    lineHeight: 20,
  },
  pill: {
    alignSelf: "flex-start",
    marginTop: 4,
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  pillText: {
    color: "#F9FAFB",
    fontSize: 11,
    fontWeight: "700",
  },
});
