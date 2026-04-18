import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ParentOverviewScreen } from "@/screens/parent/ParentOverviewScreen";
import { ParentChildrenScreen } from "@/screens/parent/ParentChildrenScreen";
import { ParentSettingsScreen } from "@/screens/parent/ParentSettingsScreen";
import { ParentSubmissionsScreen } from "@/screens/parent/ParentSubmissionsScreen";
import { ParentTabParamList } from "@/types/navigation";
import { colors } from "@/theme/theme";
import { ParentHeaderLogout } from "@/navigation/ParentHeaderLogout";

const Tab = createBottomTabNavigator<ParentTabParamList>();

const PARENT_TITLES: Record<keyof ParentTabParamList, string> = {
  Overview: "Parent Dashboard",
  Children: "Manage Children",
  Review: "Chore Reviews",
  Settings: "Settings",
};

export function ParentTabsNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        headerStyle: { backgroundColor: colors.parentHeader },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: { fontWeight: "700" },
        headerShadowVisible: false,
        headerRight: () => <ParentHeaderLogout />,
        title: PARENT_TITLES[route.name as keyof ParentTabParamList],
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.subtext,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        tabBarIcon: ({ color, size }) => {
          const iconName =
            route.name === "Overview"
              ? "view-dashboard-outline"
              : route.name === "Children"
                ? "account-group-outline"
                : route.name === "Review"
                  ? "camera-account"
                  : "cog-outline";
          return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Overview" component={ParentOverviewScreen} />
      <Tab.Screen name="Children" component={ParentChildrenScreen} />
      <Tab.Screen name="Review" component={ParentSubmissionsScreen} />
      <Tab.Screen name="Settings" component={ParentSettingsScreen} />
    </Tab.Navigator>
  );
}
