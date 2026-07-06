import { ActivityIndicator, StyleSheet, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { navigationRef } from "@/navigation/navigationRef";
import { BlockedReturnDialog } from "@/components/BlockedReturnDialog";
import { ChildAppUsageBridge } from "@/components/ChildAppUsageBridge";
import { ChildScreenLockProvider } from "@/store/ChildScreenLockContext";
import { PushNotificationBridge } from "@/components/PushNotificationBridge";
import { AuthStackNavigator } from "@/navigation/AuthStackNavigator";
import { ParentStackNavigator } from "@/navigation/ParentStackNavigator";
import { ChildTabsNavigator } from "@/navigation/ChildTabsNavigator";
import { useAuth } from "@/store/AuthContext";
import { colors } from "@/theme/theme";

export function RootNavigator() {
  const { appMode, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <NavigationContainer ref={navigationRef}>
        {appMode === "auth" ? (
          <AuthStackNavigator />
        ) : appMode === "parent" ? (
          <ParentStackNavigator />
        ) : (
          <ChildScreenLockProvider>
            <ChildTabsNavigator />
            <ChildAppUsageBridge />
            <BlockedReturnDialog />
          </ChildScreenLockProvider>
        )}
      </NavigationContainer>
      <PushNotificationBridge />
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
});
