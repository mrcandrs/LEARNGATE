import { StyleSheet } from "react-native";
import { Card, Text } from "react-native-paper";
import { colors } from "@/theme/theme";

type StatCardProps = {
  label: string;
  value: string;
};

export function StatCard({ label, value }: StatCardProps) {
  return (
    <Card style={styles.card}>
      <Card.Content>
        <Text variant="headlineSmall" style={styles.value}>
          {value}
        </Text>
        <Text variant="bodyMedium" style={styles.label}>
          {label}
        </Text>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.card,
  },
  value: {
    color: colors.text,
    fontWeight: "700",
  },
  label: {
    color: colors.subtext,
    marginTop: 4,
  },
});
