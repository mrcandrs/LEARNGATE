import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ChildProfileScreen } from "@/screens/child/ChildProfileScreen";
import { colors } from "@/theme/theme";
import { ChildHeaderLogout } from "@/navigation/ChildHeaderLogout";
import type { ChildProfileStackParamList } from "@/types/navigation";

const Stack = createNativeStackNavigator<ChildProfileStackParamList>();

export function ChildProfileStackNavigator() {
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
        name="MyStuffMain"
        component={ChildProfileScreen}
        options={{ title: "My Stuff", headerBackVisible: false, headerLeft: () => null }}
      />
    </Stack.Navigator>
  );
}

