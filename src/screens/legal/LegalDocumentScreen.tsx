import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Text } from "react-native-paper";
import { ScreenContainer } from "@/components/ScreenContainer";
import { LEGAL_DOCUMENTS } from "@/content/legalDocuments";
import type { AuthStackParamList } from "@/types/navigation";
import { useAppColors } from "@/theme/useAppColors";

type Props = NativeStackScreenProps<AuthStackParamList, "LegalDocument">;

export function LegalDocumentScreen({ route }: Props) {
  const c = useAppColors();
  const doc = LEGAL_DOCUMENTS[route.params.documentId];

  const styles = useMemo(
    () =>
      StyleSheet.create({
        meta: {
          color: c.subtext,
          marginBottom: 12,
        },
        intro: {
          color: c.text,
          lineHeight: 22,
          marginBottom: 20,
        },
        section: {
          marginBottom: 18,
        },
        sectionTitle: {
          fontWeight: "700",
          color: c.primaryDark,
          marginBottom: 8,
        },
        paragraph: {
          color: c.text,
          lineHeight: 22,
          marginBottom: 8,
        },
        bullet: {
          color: c.text,
          lineHeight: 22,
          marginBottom: 6,
          paddingLeft: 4,
        },
      }),
    [c]
  );

  return (
    <ScreenContainer scroll contentPadding={20}>
      <Text variant="bodySmall" style={styles.meta}>
        Last updated: {doc.lastUpdated}
      </Text>
      <Text variant="bodyMedium" style={styles.intro}>
        {doc.intro}
      </Text>
      {doc.sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text variant="titleSmall" style={styles.sectionTitle}>
            {section.title}
          </Text>
          {section.paragraphs.map((paragraph, index) => (
            <Text key={`${section.title}-p-${index}`} variant="bodyMedium" style={styles.paragraph}>
              {paragraph}
            </Text>
          ))}
          {section.bullets?.map((bullet) => (
            <Text key={`${section.title}-${bullet.slice(0, 24)}`} variant="bodyMedium" style={styles.bullet}>
              {"\u2022"} {bullet}
            </Text>
          ))}
          {section.footer?.map((paragraph, index) => (
            <Text key={`${section.title}-f-${index}`} variant="bodyMedium" style={styles.paragraph}>
              {paragraph}
            </Text>
          ))}
        </View>
      ))}
    </ScreenContainer>
  );
}
