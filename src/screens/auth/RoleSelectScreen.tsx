import { Image, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ScreenContainer } from "@/components/ScreenContainer";
import { RoleSelectCard } from "@/components/RoleSelectCard";
import { AuthStackParamList } from "@/types/navigation";
import { colors } from "@/theme/theme";

type Props = NativeStackScreenProps<AuthStackParamList, "RoleSelect">;

export function RoleSelectScreen({ navigation }: Props) {
  return (
    <ScreenContainer scroll>
      <View style={styles.brand}>
        <Image
          source={require("../../../assets/icon.png")}
          style={styles.logo}
          accessibilityLabel="LEARNGATE"
        />
        <Text variant="headlineMedium" style={styles.title}>
          Welcome to LEARNGATE
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Who is using the app?
        </Text>
      </View>

      <View style={styles.cards}>
        <RoleSelectCard
          title="Parent"
          description="Manage tasks, track progress & control screen time"
          iconName="account-outline"
          iconColor={colors.primaryDark}
          onPress={() => navigation.navigate("ParentLogin")}
        />
        <RoleSelectCard
          title="Child"
          description="Learn, play games & earn rewards"
          iconColor={colors.warning}
          iconName="human-child"
          onPress={() => navigation.navigate("ChildAccess")}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  brand: {
    alignItems: "center",
    marginBottom: 24,
    marginTop: 8,
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 20,
    marginBottom: 16,
  },
  title: {
    color: colors.text,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    color: colors.subtext,
    textAlign: "center",
    marginTop: 8,
  },
  cards: {
    gap: 14,
  },
});
