import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ChildProfileScreen } from "@/screens/child/ChildProfileScreen";
import { ChildSettingsScreen } from "@/screens/child/ChildSettingsScreen";
import { useTheme } from "react-native-paper";
import type { ChildProfileStackParamList } from "@/types/navigation";

const Stack = createNativeStackNavigator<ChildProfileStackParamList>();

export function ChildProfileStackNavigator() {
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
        name="MyStuffMain"
        component={ChildProfileScreen}
        options={{ title: "My Stuff", headerBackVisible: false, headerLeft: () => null }}
      />
      <Stack.Screen name="ChildSettings" component={ChildSettingsScreen} options={{ title: "Settings" }} />
    </Stack.Navigator>
  );
}

