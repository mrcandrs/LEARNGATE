import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { RoleSelectScreen } from "@/screens/auth/RoleSelectScreen";
import { ParentLoginScreen } from "@/screens/auth/ParentLoginScreen";
import { ParentSignUpScreen } from "@/screens/auth/ParentSignUpScreen";
import { ChildAccessScreen } from "@/screens/auth/ChildAccessScreen";
import { AuthStackParamList } from "@/types/navigation";

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="RoleSelect" component={RoleSelectScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ParentLogin" component={ParentLoginScreen} options={{ title: "Parent Portal" }} />
      <Stack.Screen name="ParentSignUp" component={ParentSignUpScreen} options={{ title: "Create Parent Account" }} />
      <Stack.Screen name="ChildAccess" component={ChildAccessScreen} options={{ title: "Child Access" }} />
    </Stack.Navigator>
  );
}
