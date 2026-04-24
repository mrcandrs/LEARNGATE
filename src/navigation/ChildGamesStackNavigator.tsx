import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ChildGamesScreen } from "@/screens/child/ChildGamesScreen";
import { ChildMiniGameScreen } from "@/screens/child/ChildMiniGameScreen";
import type { ChildGamesStackParamList } from "@/types/navigation";
import { colors } from "@/theme/theme";

const Stack = createNativeStackNavigator<ChildGamesStackParamList>();

export function ChildGamesStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.parentHeader },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: { fontWeight: "700" },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="GamesList" component={ChildGamesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="GamePlay" component={ChildMiniGameScreen} options={({ route }) => ({ title: route.params.title })} />
    </Stack.Navigator>
  );
}
