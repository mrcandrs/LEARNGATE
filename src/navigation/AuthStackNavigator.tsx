import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { RoleSelectScreen } from "@/screens/auth/RoleSelectScreen";
import { ParentLoginScreen } from "@/screens/auth/ParentLoginScreen";
import { ParentSignUpScreen } from "@/screens/auth/ParentSignUpScreen";
import { ChildAccessScreen } from "@/screens/auth/ChildAccessScreen";
import { AuthStackParamList } from "@/types/navigation";
import { colors } from "@/theme/theme";

const Stack = createNativeStackNavigator<AuthStackParamList>();

const greenHeader = {
  headerStyle: { backgroundColor: colors.parentHeader },
  headerTintColor: "#FFFFFF",
  headerTitleStyle: { fontWeight: "700" as const },
  headerShadowVisible: false,
};

export function AuthStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="RoleSelect" component={RoleSelectScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ParentLogin" component={ParentLoginScreen} options={{ title: "Parent Portal", ...greenHeader }} />
      <Stack.Screen name="ParentSignUp" component={ParentSignUpScreen} options={{ title: "Create Parent Account", ...greenHeader }} />
      <Stack.Screen name="ChildAccess" component={ChildAccessScreen} options={{ title: "Child Access", ...greenHeader }} />
    </Stack.Navigator>
  );
}
