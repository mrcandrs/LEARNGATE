import { StyleSheet, View } from "react-native";
import { Card, Text } from "react-native-paper";
import { ScreenContainer } from "@/components/ScreenContainer";
import { StatCard } from "@/components/StatCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAuth } from "@/store/AuthContext";
import { colors } from "@/theme/theme";
import { ParentStat } from "@/types/app";

const stats: ParentStat[] = [
  { label: "Total Learning Time", value: "12.5 hrs" },
  { label: "Tasks Completed", value: "48" },
  { label: "Stars Earned", value: "156" },
  { label: "Daily Limit", value: "2 hrs" },
];

export function ParentOverviewScreen() {
  const { signOut } = useAuth();

  return (
    <ScreenContainer scroll>
      <Text variant="headlineMedium" style={styles.title}>
        Parent Dashboard
      </Text>

      <View style={styles.grid}>
        {stats.map((item) => (
          <View key={item.label} style={styles.gridItem}>
            <StatCard label={item.label} value={item.value} />
          </View>
        ))}
      </View>

      <Card>
        <Card.Title title="Recent Activity" />
        <Card.Content style={styles.activityList}>
          <Text>Completed Reading Exercise (+10)</Text>
          <Text>Completed Math Exercise (+10)</Text>
          <Text>Set bedtime schedule for Emma</Text>
        </Card.Content>
      </Card>

      <PrimaryButton label="Sign Out" onPress={() => void signOut()} mode="outlined" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontWeight: "700",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  gridItem: {
    width: "48%",
  },
  activityList: {
    gap: 8,
  },
});
