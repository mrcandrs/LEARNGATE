import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ChildHomeScreen } from "@/screens/child/ChildHomeScreen";
import { ChildGamesStackNavigator } from "@/navigation/ChildGamesStackNavigator";
import { ChildTasksScreen } from "@/screens/child/ChildTasksScreen";
import { ChildProfileScreen } from "@/screens/child/ChildProfileScreen";
import { ChildTabParamList } from "@/types/navigation";
import { colors } from "@/theme/theme";

const Tab = createBottomTabNavigator<ChildTabParamList>();

export function ChildTabsNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
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
      <Tab.Screen name="Tasks" component={ChildTasksScreen} />
      <Tab.Screen name="MyStuff" component={ChildProfileScreen} options={{ title: "My Stuff" }} />
    </Tab.Navigator>
  );
}
