import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ScreenContainer } from "@/components/ScreenContainer";
import { AuthStackParamList } from "@/types/navigation";
import { useAuth } from "@/store/AuthContext";
import { colors } from "@/theme/theme";

type Props = NativeStackScreenProps<AuthStackParamList, "ParentLogin">;

export function ParentLoginScreen({}: Props) {
  const { selectRole, isSupabaseConfigured } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinue = async () => {
    setIsSubmitting(true);
    selectRole("parent");
    setIsSubmitting(false);
  };

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <Text variant="headlineLarge" style={styles.title}>
          Parent Login
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Sign in to manage learning, tasks, and screen time.
        </Text>

        <PrimaryButton
          label={isSupabaseConfigured ? "Continue to Parent Portal" : "Continue in Demo Mode"}
          onPress={handleContinue}
          disabled={isSubmitting}
        />

        {!isSupabaseConfigured ? (
          <Text variant="bodySmall" style={styles.warning}>
            Supabase keys are not configured yet. Add your .env values to enable real authentication.
          </Text>
        ) : null}
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
  warning: {
    marginTop: 8,
    color: colors.warning,
  },
});
