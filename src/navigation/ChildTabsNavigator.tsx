import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ChildHomeStackNavigator } from "@/navigation/ChildHomeStackNavigator";
import { ChildGamesStackNavigator } from "@/navigation/ChildGamesStackNavigator";
import { ChildTasksStackNavigator } from "@/navigation/ChildTasksStackNavigator";
import { ChildProfileStackNavigator } from "@/navigation/ChildProfileStackNavigator";
import { ChildTabParamList } from "@/types/navigation";
import { colors } from "@/theme/theme";
import { useChildLocationTracking } from "@/hooks/useChildLocationTracking";
import { useAuth } from "@/store/AuthContext";
import { useChildHeartbeat } from "@/hooks/useChildHeartbeat";
import { useTheme } from "react-native-paper";

const Tab = createBottomTabNavigator<ChildTabParamList>();

export function ChildTabsNavigator() {
  useChildLocationTracking();
  const { appMode } = useAuth();
  const theme = useTheme();
  useChildHeartbeat({ enabled: appMode === "child", intervalMs: 60_000 });

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: colors.subtext,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outlineVariant,
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
      <Tab.Screen name="Home" component={ChildHomeStackNavigator} />
      <Tab.Screen name="Games" component={ChildGamesStackNavigator} />
      <Tab.Screen name="Tasks" component={ChildTasksStackNavigator} />
      <Tab.Screen name="MyStuff" component={ChildProfileStackNavigator} />
    </Tab.Navigator>
  );
}
