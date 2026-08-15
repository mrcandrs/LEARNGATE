import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ChildHomeScreen } from "@/screens/child/ChildHomeScreen";
import { ChildTasksScreen } from "@/screens/child/ChildTasksScreen";
import { ChildProfileSettingsScreen } from "@/screens/child/ChildProfileSettingsScreen";
import { useTheme } from "react-native-paper";
import { useLocale } from "@/store/LocaleContext";
import type { ChildHomeStackParamList } from "@/types/navigation";

const Stack = createNativeStackNavigator<ChildHomeStackParamList>();

export function ChildHomeStackNavigator() {
  const theme = useTheme();
  const { t, locale } = useLocale();
  return (
    <Stack.Navigator
      key={locale}
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.primary },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: { fontWeight: "700" },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="HomeMain" component={ChildHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="TasksList" component={ChildTasksScreen} options={{ title: t("child.tasks.title") }} />
      <Stack.Screen
        name="ProfileSettings"
        component={ChildProfileSettingsScreen}
        options={{ title: t("child.profile.title") }}
      />
    </Stack.Navigator>
  );
}
