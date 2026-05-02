import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ChildHomeScreen } from "@/screens/child/ChildHomeScreen";
import { colors } from "@/theme/theme";
import { ChildHeaderLogout } from "@/navigation/ChildHeaderLogout";
import type { ChildHomeStackParamList } from "@/types/navigation";

const Stack = createNativeStackNavigator<ChildHomeStackParamList>();

export function ChildHomeStackNavigator() {
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
      <Stack.Screen name="HomeMain" component={ChildHomeScreen} options={{ title: "Home", headerBackVisible: false, headerLeft: () => null }} />
    </Stack.Navigator>
  );
}

