import { ActivityIndicator, StyleSheet, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { AuthStackNavigator } from "@/navigation/AuthStackNavigator";
import { ParentTabsNavigator } from "@/navigation/ParentTabsNavigator";
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
    <NavigationContainer>
      {appMode === "auth" ? <AuthStackNavigator /> : appMode === "parent" ? <ParentTabsNavigator /> : <ChildTabsNavigator />}
    </NavigationContainer>
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
