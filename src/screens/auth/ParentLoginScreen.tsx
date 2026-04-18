import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text, TextInput } from "react-native-paper";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ScreenContainer } from "@/components/ScreenContainer";
import { AuthStackParamList } from "@/types/navigation";
import { useAuth } from "@/store/AuthContext";
import { colors } from "@/theme/theme";
import { supabase } from "@/services/supabase";

type Props = NativeStackScreenProps<AuthStackParamList, "ParentLogin">;

export function ParentLoginScreen({ navigation }: Props) {
  const { selectRole, isSupabaseConfigured } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinue = async () => {
    if (!isSupabaseConfigured || !supabase) {
      // Keep demo behavior when backend keys are not configured.
      selectRole("parent");
      return;
    }

    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });
    setIsSubmitting(false);

    if (signInError) {
      setError(signInError.message);
    }
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

        {isSupabaseConfigured ? (
          <>
            <TextInput
              label="Email"
              mode="outlined"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              label="Password"
              mode="outlined"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </>
        ) : null}

        <PrimaryButton
          label={isSupabaseConfigured ? "Sign In" : "Continue in Demo Mode"}
          onPress={() => void handleContinue()}
          disabled={isSubmitting}
        />

        {isSupabaseConfigured ? (
          <PrimaryButton label="Create Parent Account" onPress={() => navigation.navigate("ParentSignUp")} mode="text" />
        ) : null}

        {error ? (
          <Text variant="bodySmall" style={styles.error}>
            {error}
          </Text>
        ) : null}

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
  error: {
    marginTop: 8,
    color: "#B91C1C",
  },
});
