import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ParentOverviewScreen } from "@/screens/parent/ParentOverviewScreen";
import { ParentChildrenScreen } from "@/screens/parent/ParentChildrenScreen";
import { ParentSettingsScreen } from "@/screens/parent/ParentSettingsScreen";
import { ParentSubmissionsScreen } from "@/screens/parent/ParentSubmissionsScreen";
import { ParentLocationScreen } from "@/screens/parent/ParentLocationScreen";
import { ParentTabParamList } from "@/types/navigation";
import { colors } from "@/theme/theme";
import { useParentChildPushHealthCheck } from "@/hooks/useParentChildPushHealthCheck";
import { useAuth } from "@/store/AuthContext";
import { useTheme } from "react-native-paper";

const Tab = createBottomTabNavigator<ParentTabParamList>();

const PARENT_TITLES: Record<keyof ParentTabParamList, string> = {
  Overview: "Parent Dashboard",
  Children: "Manage Children",
  Location: "Safety Location",
  Review: "Chore Reviews",
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
                ? "account-group-outline"
                : route.name === "Location"
                  ? "map-marker-radius-outline"
                : route.name === "Review"
                  ? "camera-account"
                  : "cog-outline";
          return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Overview" component={ParentOverviewScreen} />
      <Tab.Screen name="Children" component={ParentChildrenScreen} />
      <Tab.Screen name="Location" component={ParentLocationScreen} />
      <Tab.Screen name="Review" component={ParentSubmissionsScreen} />
      <Tab.Screen name="Settings" component={ParentSettingsScreen} />
    </Tab.Navigator>
  );
}
