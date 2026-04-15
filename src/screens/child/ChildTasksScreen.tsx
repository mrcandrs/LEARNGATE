import { StyleSheet } from "react-native";
import { Text } from "react-native-paper";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TaskListItem } from "@/components/TaskListItem";
import { colors } from "@/theme/theme";
import { ChildTask } from "@/types/app";

const learningTasks: ChildTask[] = [
  { id: "1", title: "Reading Comprehension", category: "Reading", reward: "+50", actionLabel: "Start" },
  { id: "2", title: "Shape Recognition", category: "Shapes", reward: "+30", actionLabel: "Start" },
  { id: "3", title: "Basic Addition", category: "Math", reward: "+50", actionLabel: "Start" },
];

const choreTasks: ChildTask[] = [
  { id: "4", title: "Wash Dishes", category: "Camera verification needed", reward: "+20", actionLabel: "Verify" },
  { id: "5", title: "Fold Clothes", category: "Camera verification needed", reward: "+15", actionLabel: "Verify" },
  { id: "6", title: "Broom Floor", category: "Camera verification needed", reward: "+20", actionLabel: "Verify" },
];

export function ChildTasksScreen() {
  return (
    <ScreenContainer scroll>
      <Text variant="headlineMedium" style={styles.title}>
        Daily Missions
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Complete 3 tasks to unlock games.
      </Text>

      <Text variant="titleLarge" style={styles.sectionTitle}>
        Learning Tasks
      </Text>
      {learningTasks.map((task) => (
        <TaskListItem key={task.id} title={task.title} subtitle={task.category} reward={task.reward} actionLabel={task.actionLabel} />
      ))}

      <Text variant="titleLarge" style={styles.sectionTitle}>
        Household Chores
      </Text>
      {choreTasks.map((task) => (
        <TaskListItem key={task.id} title={task.title} subtitle={task.category} reward={task.reward} actionLabel={task.actionLabel} />
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.subtext,
    marginBottom: 8,
  },
  sectionTitle: {
    color: colors.text,
    marginTop: 8,
    marginBottom: 4,
    fontWeight: "700",
  },
});
