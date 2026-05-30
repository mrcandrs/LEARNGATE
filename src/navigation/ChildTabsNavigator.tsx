import { Pressable } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ChildHomeStackNavigator } from "@/navigation/ChildHomeStackNavigator";
import { ChildGamesStackNavigator } from "@/navigation/ChildGamesStackNavigator";
import { ChildTasksStackNavigator } from "@/navigation/ChildTasksStackNavigator";
import { ChildProfileStackNavigator } from "@/navigation/ChildProfileStackNavigator";
import { ChildTabParamList } from "@/types/navigation";
import { useChildLocationTracking } from "@/hooks/useChildLocationTracking";
import { useAuth } from "@/store/AuthContext";
import { useChildHeartbeat } from "@/hooks/useChildHeartbeat";
import { useChildScreenLockContext } from "@/store/ChildScreenLockContext";
import { useTheme } from "react-native-paper";

const Tab = createBottomTabNavigator<ChildTabParamList>();

export function ChildTabsNavigator() {
  useChildLocationTracking();
  const { appMode } = useAuth();
  const theme = useTheme();
  const lock = useChildScreenLockContext();
  useChildHeartbeat({ enabled: appMode === "child" && !lock.isLocked, intervalMs: 60_000 });

  return (
    <Tab.Navigator
      screenListeners={{
        tabPress: (e) => {
          if (lock.isLocked) {
            e.preventDefault();
          }
        },
      }}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarStyle: lock.isLocked
          ? { display: "none", height: 0 }
          : {
              backgroundColor: theme.colors.surface,
              borderTopColor: theme.colors.outlineVariant,
            },
        tabBarButton: lock.isLocked
          ? (props) => (
              <Pressable
                style={props.style}
                accessibilityState={props.accessibilityState}
                accessibilityLabel={props.accessibilityLabel}
                onPress={() => {}}
              />
            )
          : undefined,
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
