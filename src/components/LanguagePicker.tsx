import { StyleSheet, View } from "react-native";
import { Chip } from "react-native-paper";
import { LOCALE_LABELS, type AppLocale } from "@/i18n/types";
import { useLocale } from "@/store/LocaleContext";
import { useAppColors } from "@/theme/useAppColors";

const LOCALE_ORDER: AppLocale[] = ["en", "fil"];

export function LanguagePicker() {
  const { locale, setLocale } = useLocale();
  const c = useAppColors();

  return (
    <View style={styles.row}>
      {LOCALE_ORDER.map((code) => (
        <Chip
          key={code}
          selected={locale === code}
          onPress={() => setLocale(code)}
          style={locale === code ? { backgroundColor: c.surfaceTint } : { backgroundColor: c.mutedSurface }}
          textStyle={{ color: c.text }}
        >
          {LOCALE_LABELS[code]}
        </Chip>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
