import { useEffect, useState } from "react";
import {
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthStackParamList } from "@/types/navigation";
import { useAuth } from "@/store/AuthContext";
import { colors } from "@/theme/theme";
import { supabase } from "@/services/supabase";
import { signInWithGoogleOAuth } from "@/services/googleOAuth";
import { formatAppError } from "@/utils/errors";
import { LegalFooterLinks } from "@/components/legal/LegalFooterLinks";
import { useLocale } from "@/store/LocaleContext";
import { useAppToast } from "@/store/AppToastContext";
import { sendParentSignupVerifyEmail, signInParentWithPassword } from "@/services/parentEmailAuth";

type Props = NativeStackScreenProps<AuthStackParamList, "ParentLogin">;

const GREEN = colors.roleSelectGreen;
const SHEET_BG = "#F6F7EC";
const CARD_OVERLAP = 20;

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HERO_HEIGHT = Math.round(SCREEN_WIDTH * (809 / 1080));

export function ParentLoginScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useLocale();
  const { showToast } = useAppToast();
  const { selectRole, isSupabaseConfigured, pendingParentSignup, pendingPasswordReset } = useAuth();
  const [email, setEmail] = useState(route.params?.email ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(route.params?.notice ?? null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    if (pendingPasswordReset) {
      navigation.navigate("ParentResetPassword");
      return;
    }
    if (pendingParentSignup) {
      navigation.navigate("ParentSignUp");
    }
  }, [navigation, pendingParentSignup, pendingPasswordReset]);

  useEffect(() => {
    if (route.params?.email) {
      setEmail(route.params.email);
    }
    if (route.params?.notice) {
      setInfo(route.params.notice);
      showToast(route.params.notice);
    }
  }, [route.params?.email, route.params?.notice, showToast]);

  const handleGoogle = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setError(t("auth.login.googleNeedsSupabase"));
      return;
    }
    setError(null);
    setInfo(null);
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
      setError(t("auth.login.emailPasswordRequired"));
      return;
    }

    setError(null);
    setInfo(null);
    setIsSubmitting(true);
    const trimmedEmail = email.trim();
    const result = await signInParentWithPassword(trimmedEmail, password.trim());
    setIsSubmitting(false);

    if (result.error) {
      setError(formatAppError(result.error));
      return;
    }

    if (result.status === "unverified") {
      setUnverifiedEmail(trimmedEmail);
      setInfo(t("auth.login.checkEmailUnverified"));
      return;
    }

    if (result.status === "incomplete_signup") {
      navigation.navigate("ParentSignUp");
      return;
    }
  };

  const handleResendVerify = async () => {
    const target = unverifiedEmail ?? email.trim();
    if (!target) {
      return;
    }
    setError(null);
    setIsSubmitting(true);
    const { error: resendError } = await sendParentSignupVerifyEmail(target);
    setIsSubmitting(false);
    if (resendError) {
      setError(formatAppError(resendError));
      return;
    }
    setInfo(t("auth.signUp.resendSent"));
    showToast(t("auth.signUp.resendSent"));
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.headerWrap, { height: HERO_HEIGHT + insets.top, paddingTop: insets.top }]}>
        <Image
          source={require("../../../assets/parent-login-hero.png")}
          style={styles.heroImage}
          resizeMode="cover"
          accessibilityLabel="LearnGate Parent Portal"
        />
        <Pressable
          style={[styles.backBtn, { top: insets.top + 8 }]}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t("auth.login.goBack")}
          hitSlop={12}
        />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("auth.login.title")}</Text>
            <Text style={styles.cardSubtitle}>{t("auth.login.subtitle")}</Text>

            {isSupabaseConfigured ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("auth.login.continueWithGoogle")}
                  disabled={googleBusy || isSubmitting}
                  onPress={() => void handleGoogle()}
                  style={({ pressed }) => [
                    styles.googleBtn,
                    (pressed || googleBusy) && styles.btnPressed,
                  ]}
                >
                  <Image
                    source={require("../../../assets/google-signin-g.png")}
                    style={styles.googleIcon}
                    accessibilityIgnoresInvertColors
                  />
                  <Text style={styles.googleLabel}>
                    {googleBusy ? t("auth.login.openingGoogle") : t("auth.login.continueWithGoogle")}
                  </Text>
                </Pressable>

                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>{t("auth.login.orWithEmail")}</Text>
                  <View style={styles.dividerLine} />
                </View>

                <View style={styles.field}>
                  <MaterialCommunityIcons name="email-outline" size={22} color={GREEN} style={styles.fieldIcon} />
                  <TextInput
                    style={styles.fieldInput}
                    placeholder={t("auth.login.emailPlaceholder")}
                    placeholderTextColor="#9CA3AF"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.field}>
                  <MaterialCommunityIcons name="lock-outline" size={22} color={GREEN} style={styles.fieldIcon} />
                  <TextInput
                    style={styles.fieldInput}
                    placeholder={t("auth.login.passwordPlaceholder")}
                    placeholderTextColor="#9CA3AF"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <Pressable
                    onPress={() => setShowPassword((v) => !v)}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? t("auth.login.hidePassword") : t("auth.login.showPassword")}
                    hitSlop={8}
                  >
                    <MaterialCommunityIcons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={22}
                      color="#9CA3AF"
                    />
                  </Pressable>
                </View>
              </>
            ) : null}

            {isSupabaseConfigured ? (
              <Pressable
                onPress={() =>
                  navigation.navigate("ParentForgotPassword", {
                    email: email.trim() || undefined,
                  })
                }
                style={({ pressed }) => [styles.forgotBtn, pressed && styles.btnPressed]}
                accessibilityRole="button"
                accessibilityLabel={t("auth.login.forgotPassword")}
              >
                <Text style={styles.forgotLabel}>{t("auth.login.forgotPassword")}</Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => void handleContinue()}
              disabled={isSubmitting || googleBusy}
              style={({ pressed }) => [
                styles.signInBtn,
                (pressed || isSubmitting) && styles.btnPressed,
                (isSubmitting || googleBusy) && styles.btnDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel={isSupabaseConfigured ? t("auth.login.signIn") : t("auth.login.continueDemo")}
            >
              <Text style={styles.signInLabel}>
                {isSupabaseConfigured
                  ? isSubmitting
                    ? t("auth.login.signingIn")
                    : t("auth.login.signIn")
                  : t("auth.login.continueDemo")}
              </Text>
            </Pressable>

            {isSupabaseConfigured ? (
              <Pressable
                onPress={() => navigation.navigate("ParentSignUp")}
                style={({ pressed }) => [styles.createBtn, pressed && styles.btnPressed]}
                accessibilityRole="button"
                accessibilityLabel={t("auth.login.createAccount")}
              >
                <Text style={styles.createLabel}>{t("auth.login.createAccount")}</Text>
              </Pressable>
            ) : null}

            {info ? <Text style={styles.info}>{info}</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}

            {unverifiedEmail ? (
              <Pressable
                onPress={() => void handleResendVerify()}
                disabled={isSubmitting || googleBusy}
                style={({ pressed }) => [styles.createBtn, pressed && styles.btnPressed]}
                accessibilityRole="button"
                accessibilityLabel={t("auth.signUp.resendEmail")}
              >
                <Text style={styles.createLabel}>{t("auth.signUp.resendEmail")}</Text>
              </Pressable>
            ) : null}

            {!isSupabaseConfigured ? (
              <Text style={styles.warning}>
                {t("auth.login.supabaseWarning")}
              </Text>
            ) : null}

            {isSupabaseConfigured ? <LegalFooterLinks textColor="#6B7280" /> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SHEET_BG,
  },
  flex: {
    flex: 1,
  },
  headerWrap: {
    width: SCREEN_WIDTH,
    backgroundColor: GREEN,
    overflow: "hidden",
  },
  heroImage: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
  },
  backBtn: {
    position: "absolute",
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  scrollContent: {
    paddingHorizontal: 20,
    marginTop: -CARD_OVERLAP,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 22,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1A1A1A",
    textAlign: "center",
  },
  cardSubtitle: {
    fontSize: 15,
    fontWeight: "500",
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 4,
  },
  googleIcon: {
    width: 22,
    height: 22,
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    borderWidth: 2,
    borderColor: GREEN,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
  },
  googleLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#D1D5DB",
  },
  dividerText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9CA3AF",
    letterSpacing: 0.6,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: GREEN,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 4,
    backgroundColor: "#FFFFFF",
    gap: 10,
  },
  fieldIcon: {
    marginRight: 2,
  },
  fieldInput: {
    flex: 1,
    fontSize: 16,
    color: "#1F2937",
    paddingVertical: 12,
  },
  forgotBtn: {
    alignSelf: "flex-end",
    marginTop: -4,
    marginBottom: 2,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  forgotLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: GREEN,
  },
  signInBtn: {
    backgroundColor: GREEN,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 4,
  },
  signInLabel: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  createBtn: {
    borderWidth: 2,
    borderColor: GREEN,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  createLabel: {
    fontSize: 17,
    fontWeight: "700",
    color: GREEN,
  },
  btnPressed: {
    opacity: 0.9,
  },
  btnDisabled: {
    opacity: 0.65,
  },
  error: {
    color: "#B91C1C",
    fontSize: 14,
    textAlign: "center",
  },
  info: {
    color: "#166534",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  warning: {
    color: colors.warning,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
});
