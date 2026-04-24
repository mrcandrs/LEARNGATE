import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, TextInput } from "react-native-paper";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ScreenContainer } from "@/components/ScreenContainer";
import { AuthStackParamList } from "@/types/navigation";
import { useAuth } from "@/store/AuthContext";
import { colors, radii, shadows } from "@/theme/theme";
import { supabase } from "@/services/supabase";
import { signInWithGoogleOAuth } from "@/services/googleOAuth";
import { formatAppError } from "@/utils/errors";

type Props = NativeStackScreenProps<AuthStackParamList, "ParentLogin">;

export function ParentLoginScreen({ navigation }: Props) {
  const { selectRole, isSupabaseConfigured } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const handleGoogle = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setError("Configure Supabase to use Google sign-in.");
      return;
    }
    setError(null);
    setGoogleBusy(true);
    const { error: oauthError } = await signInWithGoogleOAuth(supabase);
    setGoogleBusy(false);
    if (oauthError) {
      setError(formatAppError(oauthError));
    }
  };

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
      setError(formatAppError(signInError));
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
          Sign in to manage your child&apos;s learning journey, tasks, and screen time.
        </Text>
      </View>

      {isSupabaseConfigured ? (
        <View style={styles.card}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign in with Google"
            disabled={googleBusy || isSubmitting}
            onPress={() => void handleGoogle()}
            style={({ pressed }) => [styles.googleBtn, (pressed || googleBusy) && styles.googleBtnPressed]}
          >
            <View style={styles.googleIconWrap}>
              <MaterialCommunityIcons name="google" size={22} color="#EA4335" />
            </View>
            <Text style={styles.googleLabel}>{googleBusy ? "Opening Google…" : "Continue with Google"}</Text>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.subtext} />
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text variant="labelSmall" style={styles.dividerText}>
              or with email
            </Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.form}>
            <TextInput
              label="Email"
              mode="outlined"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
            />
            <TextInput
              label="Password"
              mode="outlined"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
            />
          </View>
        </View>
      ) : null}

      <PrimaryButton
        label={isSupabaseConfigured ? "Sign In" : "Continue in Demo Mode"}
        onPress={() => void handleContinue()}
        disabled={isSubmitting || googleBusy}
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
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
    marginBottom: 12,
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#FFFFFF",
  },
  googleBtnPressed: {
    opacity: 0.88,
  },
  googleIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
  },
  googleLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.subtext,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  form: {
    gap: 10,
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
