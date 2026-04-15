import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useAuth } from "@/store/AuthContext";
import { colors } from "@/theme/theme";

export function ChildAccessScreen() {
  const { selectRole } = useAuth();

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <Text variant="headlineLarge" style={styles.title}>
          Child Access
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Continue to a protected child profile flow. You can replace this with PIN selection next.
        </Text>
        <PrimaryButton label="Continue as Child" onPress={() => selectRole("child")} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: "center",
    gap: 10,
  },
  title: {
    color: colors.text,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.subtext,
  },
});
