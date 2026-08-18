import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Checkbox, Text, TextInput } from "react-native-paper";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ScreenContainer } from "@/components/ScreenContainer";
import { LegalFooterLinks } from "@/components/legal/LegalFooterLinks";
import { LegalLinkButton } from "@/components/legal/LegalLinkButton";
import { openLegalDocument } from "@/navigation/openLegalDocument";
import { AuthStackParamList } from "@/types/navigation";
import { useAuth } from "@/store/AuthContext";
import { colors } from "@/theme/theme";
import { supabase } from "@/services/supabase";
import { useLocale } from "@/store/LocaleContext";
import { completeParentSignup, sendParentSignupVerifyEmail } from "@/services/parentEmailAuth";
import { formatAppError } from "@/utils/errors";

type Props = NativeStackScreenProps<AuthStackParamList, "ParentSignUp">;
type SignUpStep = "email" | "wait" | "complete";

export function ParentSignUpScreen({ navigation }: Props) {
  const { isSupabaseConfigured, pendingParentSignup, finishParentSignup } = useAuth();
  const { t } = useLocale();
  const [step, setStep] = useState<SignUpStep>(pendingParentSignup ? "complete" : "email");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  useEffect(() => {
    if (pendingParentSignup) {
      setStep("complete");
      setError(null);
      setSuccessMessage(null);
    }
  }, [pendingParentSignup]);

  const handleSendVerify = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setError(t("auth.signUp.supabaseNotConfigured"));
      return;
    }
    if (!email.trim()) {
      setError(t("auth.signUp.emailRequired"));
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    const trimmedEmail = email.trim();
    const { error: sendError } = await sendParentSignupVerifyEmail(trimmedEmail);
    setIsSubmitting(false);

    if (sendError) {
      setError(formatAppError(sendError));
      return;
    }

    setPendingEmail(trimmedEmail);
    setStep("wait");
    setSuccessMessage(t("auth.signUp.waitBody", { email: trimmedEmail }));
  };

  const handleResend = async () => {
    const target = pendingEmail ?? email.trim();
    if (!target) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    const { error: resendError } = await sendParentSignupVerifyEmail(target);
    setIsSubmitting(false);
    if (resendError) {
      setError(formatAppError(resendError));
      return;
    }
    setSuccessMessage(t("auth.signUp.resendSent"));
  };

  const handleComplete = async () => {
    if (!password.trim()) {
      setError(t("auth.signUp.emailPasswordRequired"));
      return;
    }
    if (!acceptedLegal) {
      setError(t("auth.signUp.acceptLegalRequired"));
      return;
    }

    setError(null);
    setIsSubmitting(true);
    const { error: completeError } = await completeParentSignup({
      fullName: fullName.trim(),
      password: password.trim(),
    });
    setIsSubmitting(false);

    if (completeError) {
      setError(formatAppError(completeError));
      return;
    }

    await finishParentSignup();
  };

  return (
    <ScreenContainer scroll>
      <View style={styles.content}>
        <Text variant="headlineLarge" style={styles.title}>
          {step === "complete" ? t("auth.signUp.completeTitle") : t("auth.signUp.title")}
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          {step === "email"
            ? t("auth.signUp.subtitleEmail")
            : step === "wait"
              ? t("auth.signUp.waitTitle")
              : t("auth.signUp.completeSubtitle")}
        </Text>

        {step === "email" ? (
          <TextInput
            label={t("auth.signUp.email")}
            mode="outlined"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        ) : null}

        {step === "complete" ? (
          <>
            <TextInput
              label={t("auth.signUp.fullName")}
              mode="outlined"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
            />
            <TextInput
              label={t("auth.signUp.password")}
              mode="outlined"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
            <View style={styles.legalRow}>
              <Checkbox status={acceptedLegal ? "checked" : "unchecked"} onPress={() => setAcceptedLegal((v) => !v)} />
              <View style={styles.legalTextWrap}>
                <Text variant="bodySmall" style={styles.legalText}>
                  {t("auth.signUp.legalPrefix")}
                </Text>
                <View style={styles.legalLinks}>
                  <LegalLinkButton label={t("auth.signUp.terms")} onPress={() => openLegalDocument("terms")} />
                  <Text variant="bodySmall" style={styles.legalText}>
                    {t("auth.signUp.and")}
                  </Text>
                  <LegalLinkButton label={t("auth.signUp.privacy")} onPress={() => openLegalDocument("privacy")} />
                  <Text variant="bodySmall" style={styles.legalText}>
                    .
                  </Text>
                </View>
              </View>
            </View>
          </>
        ) : null}

        {step === "email" ? (
          <PrimaryButton
            label={isSubmitting ? t("auth.signUp.sendingVerify") : t("auth.signUp.sendVerify")}
            onPress={() => void handleSendVerify()}
            disabled={isSubmitting}
            loading={isSubmitting}
          />
        ) : null}

        {step === "wait" ? (
          <PrimaryButton
            label={t("auth.signUp.resendEmail")}
            onPress={() => void handleResend()}
            disabled={isSubmitting}
            loading={isSubmitting}
          />
        ) : null}

        {step === "complete" ? (
          <PrimaryButton
            label={t("auth.signUp.createAccount")}
            onPress={() => void handleComplete()}
            disabled={isSubmitting || !acceptedLegal}
            loading={isSubmitting}
          />
        ) : null}

        <PrimaryButton label={t("auth.signUp.backToLogin")} onPress={() => navigation.navigate("ParentLogin")} mode="text" />

        <LegalFooterLinks align="left" />

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
  legalRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
    marginTop: 4,
  },
  legalTextWrap: {
    flex: 1,
    gap: 2,
  },
  legalLinks: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
  },
  legalText: {
    color: colors.subtext,
    lineHeight: 20,
  },
});
