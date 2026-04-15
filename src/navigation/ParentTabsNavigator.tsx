import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ParentOverviewScreen } from "@/screens/parent/ParentOverviewScreen";
import { ParentChildrenScreen } from "@/screens/parent/ParentChildrenScreen";
import { ParentSettingsScreen } from "@/screens/parent/ParentSettingsScreen";
import { ParentTabParamList } from "@/types/navigation";
import { colors } from "@/theme/theme";

const Tab = createBottomTabNavigator<ParentTabParamList>();

export function ParentTabsNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.subtext,
        tabBarIcon: ({ color, size }) => {
          const iconName =
            route.name === "Overview" ? "view-dashboard-outline" : route.name === "Children" ? "account-group-outline" : "cog-outline";
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
