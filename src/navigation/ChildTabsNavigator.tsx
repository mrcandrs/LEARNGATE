import { Pressable, StyleSheet, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "react-native-paper";
import { ChildHomeStackNavigator } from "@/navigation/ChildHomeStackNavigator";
import { ChildActivitiesStackNavigator } from "@/navigation/ChildActivitiesStackNavigator";
import { childTabBarVisibleStyle } from "@/navigation/childTabBarStyle";
import { ChildTabParamList } from "@/types/navigation";
import { useChildLocationTracking } from "@/hooks/useChildLocationTracking";
import { useAuth } from "@/store/AuthContext";
import { useChildHeartbeat } from "@/hooks/useChildHeartbeat";
import { useChildScreenLockContext } from "@/store/ChildScreenLockContext";
import { useTheme } from "react-native-paper";
import { useLocale } from "@/store/LocaleContext";
import { useAppColors } from "@/theme/useAppColors";
import { radii } from "@/theme/theme";

const Tab = createBottomTabNavigator<ChildTabParamList>();

function TabIcon({
  focused,
  icon,
  label,
  activeColor,
}: {
  focused: boolean;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  activeColor: string;
}) {
  const c = useAppColors();
  return (
    <View style={[tabStyles.wrap, focused && { backgroundColor: c.surfaceTint }]}>
      <MaterialCommunityIcons name={icon} size={22} color={focused ? activeColor : c.subtext} />
      <Text variant="labelSmall" style={{ color: focused ? c.primary : c.subtext, fontWeight: focused ? "700" : "500" }}>
        {label}
      </Text>
    </View>
  );
}

export function ChildTabsNavigator() {
  useChildLocationTracking();
  const { appMode } = useAuth();
  const theme = useTheme();
  const { t, locale } = useLocale();
  const lock = useChildScreenLockContext();
  useChildHeartbeat({ enabled: appMode === "child" && !lock.isLocked, intervalMs: 60_000 });

  return (
    <Tab.Navigator
      key={locale}
      screenListeners={{
        tabPress: (e) => {
          if (lock.isLocked) {
            e.preventDefault();
          }
        },
      }}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: lock.isLocked
          ? { display: "none", height: 0 }
          : childTabBarVisibleStyle(theme.colors.surface),
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
      }}
    >
      <Tab.Screen
        name="Home"
        component={ChildHomeStackNavigator}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="home-outline" label={t("child.tabs.home")} activeColor={theme.colors.primary} />
          ),
        }}
      />
      <Tab.Screen
        name="Activities"
        component={ChildActivitiesStackNavigator}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              icon="gamepad-variant-outline"
              label={t("child.tabs.activities")}
              activeColor={theme.colors.secondary}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const tabStyles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: radii.pill,
    gap: 2,
    minWidth: 100,
  },
});
