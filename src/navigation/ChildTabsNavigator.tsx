import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ChildHomeScreen } from "@/screens/child/ChildHomeScreen";
import { ChildGamesStackNavigator } from "@/navigation/ChildGamesStackNavigator";
import { ChildTasksStackNavigator } from "@/navigation/ChildTasksStackNavigator";
import { ChildProfileScreen } from "@/screens/child/ChildProfileScreen";
import { ChildTabParamList } from "@/types/navigation";
import { colors } from "@/theme/theme";
import { useChildLocationTracking } from "@/hooks/useChildLocationTracking";
import { ChildHeaderLogout } from "@/navigation/ChildHeaderLogout";
import { useAuth } from "@/store/AuthContext";
import { useChildHeartbeat } from "@/hooks/useChildHeartbeat";

const Tab = createBottomTabNavigator<ChildTabParamList>();

export function ChildTabsNavigator() {
  useChildLocationTracking();
  const { appMode } = useAuth();
  useChildHeartbeat({ enabled: appMode === "child", intervalMs: 60_000 });

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        headerStyle: { backgroundColor: colors.primaryDark },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: { fontWeight: "700" },
        headerShadowVisible: false,
        headerRight: () => <ChildHeaderLogout />,
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.subtext,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        tabBarIcon: ({ color, size }) => {
          const iconName =
            route.name === "Home"
              ? "home-outline"
              : route.name === "Games"
                ? "gamepad-variant-outline"
                : route.name === "Tasks"
                  ? "clipboard-text-outline"
                  : "account-outline";
          return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={ChildHomeScreen} options={{ title: "Home" }} />
      <Tab.Screen name="Games" component={ChildGamesStackNavigator} options={{ headerShown: false }} />
      <Tab.Screen name="Tasks" component={ChildTasksStackNavigator} options={{ headerShown: false }} />
      <Tab.Screen name="MyStuff" component={ChildProfileScreen} options={{ title: "My Stuff" }} />
    </Tab.Navigator>
  );
}
