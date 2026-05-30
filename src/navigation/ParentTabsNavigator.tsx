import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ParentOverviewScreen } from "@/screens/parent/ParentOverviewScreen";
import { ParentChildrenScreen } from "@/screens/parent/ParentChildrenScreen";
import { ParentSettingsScreen } from "@/screens/parent/ParentSettingsScreen";
import { ParentTabParamList } from "@/types/navigation";
import { NotificationBell } from "@/components/NotificationBell";
import { useParentChildPushHealthCheck } from "@/hooks/useParentChildPushHealthCheck";
import { useAuth } from "@/store/AuthContext";
import { useTheme } from "react-native-paper";

const Tab = createBottomTabNavigator<ParentTabParamList>();

const PARENT_TITLES: Record<keyof ParentTabParamList, string> = {
  Overview: "Home",
  Children: "Manage Children",
  Settings: "Settings",
};

export function ParentTabsNavigator() {
  const theme = useTheme();
  const { appMode } = useAuth();
  useParentChildPushHealthCheck(appMode === "parent");

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        headerStyle: { backgroundColor: theme.colors.primary },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: { fontWeight: "700" },
        headerShadowVisible: false,
        headerRight: () => <NotificationBell enabled={appMode === "parent"} variant="header" />,
        title: PARENT_TITLES[route.name as keyof ParentTabParamList],
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outlineVariant,
        },
        tabBarIcon: ({ color, size }) => {
          const iconName =
            route.name === "Overview"
              ? "view-dashboard-outline"
              : route.name === "Children"
                ? "account-child"
                : "cog-outline";
          return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Overview" component={ParentOverviewScreen} />
      <Tab.Screen name="Children" component={ParentChildrenScreen} />
      <Tab.Screen name="Settings" component={ParentSettingsScreen} />
    </Tab.Navigator>
  );
}
