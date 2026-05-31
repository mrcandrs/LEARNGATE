import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ChildActivitiesScreen } from "@/screens/child/ChildActivitiesScreen";
import { ChildMiniGameScreen } from "@/screens/child/ChildMiniGameScreen";
import { ChildExerciseSessionScreen } from "@/screens/child/ChildExerciseSessionScreen";
import { useTheme } from "react-native-paper";
import type { ChildActivitiesStackParamList } from "@/types/navigation";

const Stack = createNativeStackNavigator<ChildActivitiesStackParamList>();

export function ChildActivitiesStackNavigator() {
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
        name="ActivitiesMain"
        component={ChildActivitiesScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="GamePlay" component={ChildMiniGameScreen} options={({ route }) => ({ title: route.params.title })} />
      <Stack.Screen
        name="ExerciseSession"
        component={ChildExerciseSessionScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
