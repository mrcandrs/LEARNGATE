import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ScreenContainer } from "@/components/ScreenContainer";
import { PrimaryButton } from "@/components/PrimaryButton";
import { AuthStackParamList } from "@/types/navigation";
import { colors } from "@/theme/theme";

type Props = NativeStackScreenProps<AuthStackParamList, "RoleSelect">;

export function RoleSelectScreen({ navigation }: Props) {
  return (
    <ScreenContainer>
      <View style={styles.hero}>
        <Text variant="headlineMedium" style={styles.title}>
          Welcome to LEARNGATE
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Who is using the app?
        </Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton label="Parent" onPress={() => navigation.navigate("ParentLogin")} />
        <PrimaryButton label="Child" onPress={() => navigation.navigate("ChildAccess")} mode="outlined" />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    flex: 1,
    justifyContent: "center",
    gap: 8,
  },
  title: {
    color: colors.text,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.subtext,
  },
  actions: {
    gap: 8,
    marginBottom: 24,
  },
});
