import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ChildGamesScreen } from "@/screens/child/ChildGamesScreen";
import { ChildMiniGameScreen } from "@/screens/child/ChildMiniGameScreen";
import type { ChildGamesStackParamList } from "@/types/navigation";
import { colors } from "@/theme/theme";
import { ChildHeaderLogout } from "@/navigation/ChildHeaderLogout";

const Stack = createNativeStackNavigator<ChildGamesStackParamList>();

export function ChildGamesStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.primaryDark },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: { fontWeight: "700" },
        headerShadowVisible: false,
        headerRight: () => <ChildHeaderLogout />,
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
