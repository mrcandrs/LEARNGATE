import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ChildTasksScreen } from "@/screens/child/ChildTasksScreen";
import { ChildExerciseSessionScreen } from "@/screens/child/ChildExerciseSessionScreen";
import type { ChildTasksStackParamList } from "@/types/navigation";
import { colors } from "@/theme/theme";

const Stack = createNativeStackNavigator<ChildTasksStackParamList>();

export function ChildTasksStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.parentHeader },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: { fontWeight: "700" },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="TasksList" component={ChildTasksScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ExerciseSession" component={ChildExerciseSessionScreen} options={({ route }) => ({ title: route.params.title })} />
    </Stack.Navigator>
  );
}

