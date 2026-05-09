import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ChildGamesScreen } from "@/screens/child/ChildGamesScreen";
import { ChildMiniGameScreen } from "@/screens/child/ChildMiniGameScreen";
import type { ChildGamesStackParamList } from "@/types/navigation";
import { useTheme } from "react-native-paper";

const Stack = createNativeStackNavigator<ChildGamesStackParamList>();

export function ChildGamesStackNavigator() {
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
        name="GamesList"
        component={ChildGamesScreen}
        options={{ title: "Games", headerBackVisible: false, headerLeft: () => null }}
      />
      <Stack.Screen name="GamePlay" component={ChildMiniGameScreen} options={({ route }) => ({ title: route.params.title })} />
    </Stack.Navigator>
  );
}
