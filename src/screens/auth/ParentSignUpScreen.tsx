import { useState } from "react";
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

type Props = NativeStackScreenProps<AuthStackParamList, "ParentSignUp">;

export function ParentSignUpScreen({ navigation }: Props) {
  const { isSupabaseConfigured } = useAuth();
  const { t } = useLocale();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [acceptedLegal, setAcceptedLegal] = useState(false);

  const handleSignUp = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setError(t("auth.signUp.supabaseNotConfigured"));
      return;
    }

    if (!email.trim() || !password.trim()) {
      setError(t("auth.signUp.emailPasswordRequired"));
      return;
    }

    if (!acceptedLegal) {
      setError(t("auth.signUp.acceptLegalRequired"));
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

    setSuccessMessage(t("auth.signUp.successMessage"));
    setTimeout(() => {
      navigation.navigate("ParentLogin");
    }, 800);
  };

  return (
    <ScreenContainer scroll>
      <View style={styles.content}>
        <Text variant="headlineLarge" style={styles.title}>
          {t("auth.signUp.title")}
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          {t("auth.signUp.subtitle")}
        </Text>

        <TextInput label={t("auth.signUp.fullName")} mode="outlined" value={fullName} onChangeText={setFullName} autoCapitalize="words" />
        <TextInput
          label={t("auth.signUp.email")}
          mode="outlined"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
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

        <PrimaryButton
          label={t("auth.signUp.createAccount")}
          onPress={() => void handleSignUp()}
          disabled={isSubmitting || !acceptedLegal}
        />
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
