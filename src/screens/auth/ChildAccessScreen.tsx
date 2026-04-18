import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text, TextInput } from "react-native-paper";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useAuth } from "@/store/AuthContext";
import { colors } from "@/theme/theme";
import { supabase } from "@/services/supabase";

export function ChildAccessScreen() {
  const { selectRole, isSupabaseConfigured } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChildSignIn = async () => {
    if (!isSupabaseConfigured || !supabase) {
      selectRole("child");
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
      return;
    }
    // App mode will be resolved by AuthContext via profiles.role.
  };

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <Text variant="headlineLarge" style={styles.title}>
          Child Access
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Sign in with a child account linked to a child profile.
        </Text>

        {isSupabaseConfigured ? (
          <>
            <TextInput
              label="Child Email"
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
          label={isSupabaseConfigured ? "Sign In as Child" : "Continue as Child (Demo)"}
          onPress={() => void handleChildSignIn()}
          disabled={isSubmitting}
        />

        {error ? (
          <Text variant="bodySmall" style={styles.errorText}>
            {error}
          </Text>
        ) : null}

        {!isSupabaseConfigured ? (
          <Text variant="bodySmall" style={styles.warningText}>
            Supabase keys are not configured yet. Add your .env values to enable real child authentication.
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
  errorText: {
    color: "#B91C1C",
    marginTop: 6,
  },
  warningText: {
    color: colors.warning,
    marginTop: 6,
  },
});
