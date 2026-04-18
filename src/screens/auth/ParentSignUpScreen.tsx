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

type Props = NativeStackScreenProps<AuthStackParamList, "ParentSignUp">;

export function ParentSignUpScreen({ navigation }: Props) {
  const { isSupabaseConfigured } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSignUp = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase is not configured. Add your .env keys first.");
      return;
    }

    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password: password.trim(),
      options: {
        data: {
          full_name: fullName.trim(),
        },
      },
    });

    setIsSubmitting(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    setSuccessMessage("Account created successfully. You can now sign in.");
    setTimeout(() => {
      navigation.navigate("ParentLogin");
    }, 800);
  };

  return (
    <ScreenContainer scroll>
      <View style={styles.content}>
        <Text variant="headlineLarge" style={styles.title}>
          Parent Sign Up
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Create a parent account to manage children, tasks, and screen time.
        </Text>

        <TextInput label="Full Name" mode="outlined" value={fullName} onChangeText={setFullName} autoCapitalize="words" />
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

        <PrimaryButton label="Create Account" onPress={() => void handleSignUp()} disabled={isSubmitting} />
        <PrimaryButton label="Back to Login" onPress={() => navigation.navigate("ParentLogin")} mode="text" />

        {error ? (
          <Text variant="bodySmall" style={styles.errorText}>
            {error}
          </Text>
        ) : null}

        {successMessage ? (
          <Text variant="bodySmall" style={styles.successText}>
            {successMessage}
          </Text>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    gap: 12,
  },
  title: {
    color: colors.text,
    fontWeight: "700",
    marginTop: 8,
  },
  subtitle: {
    color: colors.subtext,
    marginBottom: 8,
  },
  errorText: {
    color: "#B91C1C",
    marginTop: 4,
  },
  successText: {
    color: colors.primaryDark,
    marginTop: 4,
  },
});
