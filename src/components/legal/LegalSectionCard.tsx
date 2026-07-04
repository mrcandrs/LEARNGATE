import { StyleSheet, View } from "react-native";
import { Card, Divider, List, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LEGAL_CONTACT_EMAIL, LEGAL_LAST_UPDATED } from "@/content/legalDocuments";
import { openLegalDocument } from "@/navigation/openLegalDocument";
import { useAppColors } from "@/theme/useAppColors";
import { radii, shadows } from "@/theme/theme";

export function LegalSectionCard() {
  const c = useAppColors();

  return (
    <Card style={[styles.card, { backgroundColor: c.card }, shadows.card]}>
      <Card.Title
        title="Legal"
        subtitle={`Privacy Policy & Terms · Updated ${LEGAL_LAST_UPDATED}`}
        left={(props) => <MaterialCommunityIcons {...props} name="scale-balance" size={24} color={c.primaryDark} />}
      />
      <Card.Content style={styles.content}>
        <Text variant="bodySmall" style={{ color: c.subtext, lineHeight: 20 }}>
          LearnGate collects child activity, location, and app usage data to provide parental controls you enable.
          Review how we handle data and your responsibilities as a parent account holder.
        </Text>
        <Divider style={styles.divider} />
        <List.Item
          title="Privacy Policy"
          description="What we collect, why, and your choices"
          left={(props) => <List.Icon {...props} icon="shield-account-outline" color={c.primaryDark} />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => openLegalDocument("privacy")}
          style={styles.row}
        />
        <List.Item
          title="Terms & Conditions"
          description="Account rules, monitoring features, and liability"
          left={(props) => <List.Icon {...props} icon="file-document-outline" color={c.primaryDark} />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => openLegalDocument("terms")}
          style={styles.row}
        />
        <View style={[styles.contactBox, { backgroundColor: c.mutedSurface }]}>
          <MaterialCommunityIcons name="email-outline" size={18} color={c.subtext} />
          <Text variant="bodySmall" style={{ color: c.subtext, flex: 1 }}>
            Privacy or data requests: {LEGAL_CONTACT_EMAIL}
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.md,
  },
  content: {
    gap: 4,
    paddingTop: 0,
  },
  divider: {
    marginVertical: 8,
  },
  row: {
    paddingHorizontal: 0,
  },
  contactBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
});
