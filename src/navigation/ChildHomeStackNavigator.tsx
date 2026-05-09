import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ChildHomeScreen } from "@/screens/child/ChildHomeScreen";
import { useTheme } from "react-native-paper";
import type { ChildHomeStackParamList } from "@/types/navigation";

const Stack = createNativeStackNavigator<ChildHomeStackParamList>();

export function ChildHomeStackNavigator() {
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
      <Stack.Screen name="HomeMain" component={ChildHomeScreen} options={{ title: "Home", headerBackVisible: false, headerLeft: () => null }} />
    </Stack.Navigator>
  );
}

