import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { LegalLinkButton } from "@/components/legal/LegalLinkButton";
import { openLegalDocument } from "@/navigation/openLegalDocument";
import { useAppColors } from "@/theme/useAppColors";
import { useLocale } from "@/store/LocaleContext";

type Props = {
  align?: "center" | "left";
  textColor?: string;
};

export function LegalFooterLinks({ align = "center", textColor }: Props) {
  const c = useAppColors();
  const { t } = useLocale();
  const color = textColor ?? c.subtext;

  return (
    <View style={[styles.row, align === "center" && styles.centered]}>
      <Text variant="bodySmall" style={{ color }}>
        {t("legal.footerAgree")}{" "}
      </Text>
      <LegalLinkButton label={t("legal.termsShort")} onPress={() => openLegalDocument("terms")} color={c.primaryDark} />
      <Text variant="bodySmall" style={{ color }}>
        {" "}
        {t("legal.footerAnd")}{" "}
      </Text>
      <LegalLinkButton label={t("legal.privacy")} onPress={() => openLegalDocument("privacy")} color={c.primaryDark} />
      <Text variant="bodySmall" style={{ color }}>
        .
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: 8,
  },
  centered: {
    justifyContent: "center",
  },
});
