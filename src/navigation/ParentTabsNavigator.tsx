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
import { useLocale } from "@/store/LocaleContext";

const Tab = createBottomTabNavigator<ParentTabParamList>();

export function ParentTabsNavigator() {
  const theme = useTheme();
  const { t, locale } = useLocale();
  const { appMode } = useAuth();
  useParentChildPushHealthCheck(appMode === "parent");

  const parentTitles: Record<keyof ParentTabParamList, string> = {
    Overview: t("parent.tabs.overview"),
    Children: t("parent.tabs.children"),
    Settings: t("parent.tabs.settings"),
  };

  return (
    <Tab.Navigator
      key={locale}
      screenOptions={({ route }) => ({
        headerShown: true,
        headerStyle: { backgroundColor: theme.colors.primary },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: { fontWeight: "700" },
        headerShadowVisible: false,
        headerRight: () => <NotificationBell enabled={appMode === "parent"} variant="header" />,
        title: parentTitles[route.name as keyof ParentTabParamList],
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
