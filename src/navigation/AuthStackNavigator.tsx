import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { RoleSelectScreen } from "@/screens/auth/RoleSelectScreen";
import { ParentLoginScreen } from "@/screens/auth/ParentLoginScreen";
import { ParentSignUpScreen } from "@/screens/auth/ParentSignUpScreen";
import { ParentForgotPasswordScreen } from "@/screens/auth/ParentForgotPasswordScreen";
import { ParentResetPasswordScreen } from "@/screens/auth/ParentResetPasswordScreen";
import { ChildAccessScreen } from "@/screens/auth/ChildAccessScreen";
import { LegalDocumentScreen } from "@/screens/legal/LegalDocumentScreen";
import { legalDocumentLabel } from "@/content/legalDocuments";
import { AuthStackParamList } from "@/types/navigation";
import { colors } from "@/theme/theme";
import { useLocale } from "@/store/LocaleContext";

const Stack = createNativeStackNavigator<AuthStackParamList>();

const greenHeader = {
  headerStyle: { backgroundColor: colors.parentHeader },
  headerTintColor: "#FFFFFF",
  headerTitleStyle: { fontWeight: "700" as const },
  headerShadowVisible: false,
};

export function AuthStackNavigator() {
  const { t } = useLocale();

  return (
    <Stack.Navigator>
      <Stack.Screen name="RoleSelect" component={RoleSelectScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ParentLogin" component={ParentLoginScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="ParentSignUp"
        component={ParentSignUpScreen}
        options={{ title: t("auth.signUp.title"), ...greenHeader }}
      />
      <Stack.Screen
        name="ParentForgotPassword"
        component={ParentForgotPasswordScreen}
        options={{ title: t("auth.forgotPassword.title"), ...greenHeader }}
      />
      <Stack.Screen
        name="ParentResetPassword"
        component={ParentResetPasswordScreen}
        options={{ title: t("auth.resetPassword.title"), ...greenHeader }}
      />
      <Stack.Screen name="ChildAccess" component={ChildAccessScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="LegalDocument"
        component={LegalDocumentScreen}
        options={({ route }) => ({
          title: legalDocumentLabel(route.params.documentId),
          ...greenHeader,
        })}
      />
    </Stack.Navigator>
  );
}
