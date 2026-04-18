import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text, TextInput } from "react-native-paper";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ScreenContainer } from "@/components/ScreenContainer";
import { AuthStackParamList } from "@/types/navigation";
import { useAuth } from "@/store/AuthContext";
import { colors, radii, shadows } from "@/theme/theme";
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
    <ScreenContainer scroll>
      <View style={styles.hero}>
        <View style={styles.avatarRing}>
          <MaterialCommunityIcons name="account-heart" size={40} color="#FFFFFF" />
        </View>
        <Text variant="headlineLarge" style={styles.title}>
          Parent Login
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Sign in with your account to manage your child&apos;s learning journey.
        </Text>
      </View>

      {isSupabaseConfigured ? (
        <View style={styles.form}>
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
        </View>
      ) : null}

      {isSupabaseConfigured ? (
        <View style={styles.googleCard}>
          <PrimaryButton
            label="Sign in with Google (coming soon)"
            mode="outlined"
            onPress={() => setError("Connect Google in Supabase Auth, then wire signInWithOAuth here.")}
          />
          <Text variant="bodySmall" style={styles.orText}>
            or use email & password below
          </Text>
        </View>
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
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    marginBottom: 16,
  },
  avatarRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    borderWidth: 4,
    borderColor: "#F5C542",
    alignItems: "center",
    justifyContent: "center",
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
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  form: {
    gap: 10,
    marginBottom: 8,
  },
  googleCard: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
    marginBottom: 8,
  },
  orText: {
    color: colors.subtext,
    textAlign: "center",
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
