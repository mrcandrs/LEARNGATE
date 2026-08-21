import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text, TextInput } from "react-native-paper";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ScreenContainer } from "@/components/ScreenContainer";
import { AuthStackParamList } from "@/types/navigation";
import { useAuth } from "@/store/AuthContext";
import { useAppToast } from "@/store/AppToastContext";
import { useLocale } from "@/store/LocaleContext";
import { colors } from "@/theme/theme";
import { supabase } from "@/services/supabase";
import { sendParentPasswordResetEmail } from "@/services/parentEmailAuth";
import { formatAppError } from "@/utils/errors";

type Props = NativeStackScreenProps<AuthStackParamList, "ParentForgotPassword">;

export function ParentForgotPasswordScreen({ navigation, route }: Props) {
  const { isSupabaseConfigured } = useAuth();
  const { t } = useLocale();
  const { showToast } = useAppToast();
  const [email, setEmail] = useState(route.params?.email ?? "");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSend = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setError(t("auth.forgotPassword.supabaseNotConfigured"));
      return;
    }
    if (!email.trim()) {
      setError(t("auth.forgotPassword.emailRequired"));
      return;
    }

    setError(null);
    setIsSubmitting(true);
    const trimmed = email.trim();
    const { error: sendError, reason } = await sendParentPasswordResetEmail(trimmed);
    setIsSubmitting(false);

    if (sendError) {
      if (reason === "not_registered") {
        setError(t("auth.forgotPassword.notRegistered"));
        return;
      }
      setError(formatAppError(sendError));
      return;
    }

    setSent(true);
    showToast(t("auth.forgotPassword.sentToast"));
  };

  return (
    <ScreenContainer scroll>
      <View style={styles.content}>
        <Text variant="headlineLarge" style={styles.title}>
          {t("auth.forgotPassword.title")}
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          {sent
            ? t("auth.forgotPassword.waitBody", { email: email.trim() })
            : t("auth.forgotPassword.subtitle")}
        </Text>

        {!sent ? (
          <TextInput
            label={t("auth.forgotPassword.email")}
            mode="outlined"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        ) : null}

        {!sent ? (
          <PrimaryButton
            label={isSubmitting ? t("auth.forgotPassword.sending") : t("auth.forgotPassword.sendLink")}
            onPress={() => void handleSend()}
            disabled={isSubmitting}
            loading={isSubmitting}
          />
        ) : (
          <PrimaryButton
            label={t("auth.forgotPassword.resend")}
            onPress={() => void handleSend()}
            disabled={isSubmitting}
            loading={isSubmitting}
          />
        )}

        <PrimaryButton
          label={t("auth.forgotPassword.backToLogin")}
          onPress={() => navigation.navigate("ParentLogin", { email: email.trim() || undefined })}
          mode="text"
        />

        {error ? (
          <Text variant="bodySmall" style={styles.errorText}>
            {error}
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
});
