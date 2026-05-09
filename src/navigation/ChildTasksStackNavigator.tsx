import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ChildTasksScreen } from "@/screens/child/ChildTasksScreen";
import { ChildExerciseSessionScreen } from "@/screens/child/ChildExerciseSessionScreen";
import type { ChildTasksStackParamList } from "@/types/navigation";
import { useTheme } from "react-native-paper";

const Stack = createNativeStackNavigator<ChildTasksStackParamList>();

export function ChildTasksStackNavigator() {
  const theme = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.primary },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: { fontWeight: "700" },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="TasksList"
        component={ChildTasksScreen}
        options={{ title: "Tasks", headerBackVisible: false, headerLeft: () => null }}
      />
      <Stack.Screen name="ExerciseSession" component={ChildExerciseSessionScreen} options={({ route }) => ({ title: route.params.title })} />
    </Stack.Navigator>
  );
}

