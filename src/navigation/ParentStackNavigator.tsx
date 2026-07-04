import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ParentTabsNavigator } from "@/navigation/ParentTabsNavigator";
import { LegalDocumentScreen } from "@/screens/legal/LegalDocumentScreen";
import { legalDocumentLabel } from "@/content/legalDocuments";
import type { ParentStackParamList } from "@/types/navigation";
import { colors } from "@/theme/theme";

const Stack = createNativeStackNavigator<ParentStackParamList>();

const greenHeader = {
  headerStyle: { backgroundColor: colors.parentHeader },
  headerTintColor: "#FFFFFF",
  headerTitleStyle: { fontWeight: "700" as const },
  headerShadowVisible: false,
};

export function ParentStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="ParentTabs" component={ParentTabsNavigator} options={{ headerShown: false }} />
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
