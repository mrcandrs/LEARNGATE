import { useEffect, useState } from "react";
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
import { updateParentPassword } from "@/services/parentEmailAuth";
import { formatAppError } from "@/utils/errors";

type Props = NativeStackScreenProps<AuthStackParamList, "ParentResetPassword">;

export function ParentResetPasswordScreen({ navigation }: Props) {
  const { pendingPasswordReset, signOut, holdOnAuth, releaseAuthHold, clearPasswordReset } = useAuth();
  const { t } = useLocale();
  const { showToast } = useAppToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (pendingPasswordReset) {
      showToast(t("auth.resetPassword.linkOpenedToast"));
    }
  }, [pendingPasswordReset, showToast, t]);

  const handleSave = async () => {
    if (!password.trim() || !confirmPassword.trim()) {
      setError(t("auth.resetPassword.passwordRequired"));
      return;
    }
    if (password.trim().length < 6) {
      setError(t("auth.resetPassword.passwordTooShort"));
      return;
    }
    if (password.trim() !== confirmPassword.trim()) {
      setError(t("auth.resetPassword.passwordMismatch"));
      return;
    }

    setError(null);
    setIsSubmitting(true);
    holdOnAuth();
    const { error: updateError } = await updateParentPassword(password.trim());
    if (updateError) {
      releaseAuthHold();
      setIsSubmitting(false);
      setError(formatAppError(updateError));
      return;
    }

    clearPasswordReset();
    await signOut();
    showToast(t("auth.resetPassword.successToast"));
    navigation.reset({
      index: 0,
      routes: [
        {
          name: "ParentLogin",
          params: { notice: t("auth.resetPassword.successToast") },
        },
      ],
    });
  };

  return (
    <ScreenContainer scroll>
      <View style={styles.content}>
        <Text variant="headlineLarge" style={styles.title}>
          {t("auth.resetPassword.title")}
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          {t("auth.resetPassword.subtitle")}
        </Text>

        <TextInput
          label={t("auth.resetPassword.newPassword")}
          mode="outlined"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          right={
            <TextInput.Icon
              icon={showPassword ? "eye-off-outline" : "eye-outline"}
              onPress={() => setShowPassword((v) => !v)}
              accessibilityLabel={showPassword ? t("auth.login.hidePassword") : t("auth.login.showPassword")}
            />
          }
        />
        <TextInput
          label={t("auth.resetPassword.confirmPassword")}
          mode="outlined"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showConfirm}
          autoCapitalize="none"
          right={
            <TextInput.Icon
              icon={showConfirm ? "eye-off-outline" : "eye-outline"}
              onPress={() => setShowConfirm((v) => !v)}
              accessibilityLabel={showConfirm ? t("auth.login.hidePassword") : t("auth.login.showPassword")}
            />
          }
        />

        <PrimaryButton
          label={isSubmitting ? t("auth.resetPassword.saving") : t("auth.resetPassword.save")}
          onPress={() => void handleSave()}
          disabled={isSubmitting}
          loading={isSubmitting}
        />

        <PrimaryButton
          label={t("auth.resetPassword.backToLogin")}
          mode="text"
          onPress={() => {
            clearPasswordReset();
            void signOut().then(() => {
              navigation.navigate("ParentLogin");
            });
          }}
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
