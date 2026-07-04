import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { LegalLinkButton } from "@/components/legal/LegalLinkButton";
import { openLegalDocument } from "@/navigation/openLegalDocument";
import { useAppColors } from "@/theme/useAppColors";

type Props = {
  align?: "center" | "left";
  textColor?: string;
};

export function LegalFooterLinks({ align = "center", textColor }: Props) {
  const c = useAppColors();
  const color = textColor ?? c.subtext;

  return (
    <View style={[styles.row, align === "center" && styles.centered]}>
      <Text variant="bodySmall" style={{ color }}>
        By using LearnGate you agree to our{" "}
      </Text>
      <LegalLinkButton label="Terms" onPress={() => openLegalDocument("terms")} color={c.primaryDark} />
      <Text variant="bodySmall" style={{ color }}>
        {" "}
        and{" "}
      </Text>
      <LegalLinkButton label="Privacy Policy" onPress={() => openLegalDocument("privacy")} color={c.primaryDark} />
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
