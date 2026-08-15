import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthStackParamList } from "@/types/navigation";
import { useAuth } from "@/store/AuthContext";
import { colors } from "@/theme/theme";
import { supabase } from "@/services/supabase";
import { formatAppError } from "@/utils/errors";
import { useLocale } from "@/store/LocaleContext";

type Props = NativeStackScreenProps<AuthStackParamList, "ChildAccess">;

const GREEN = colors.roleSelectGreen;
const SHEET_BG = "#F6F7EC";
const CARD_OVERLAP = 20;

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HERO_HEIGHT = Math.round(SCREEN_WIDTH * (809 / 1080));

export function ChildAccessScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useLocale();
  const { selectRole, isSupabaseConfigured } = useAuth();
  const [childName, setChildName] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successToastVisible, setSuccessToastVisible] = useState(false);
  const lastAttemptRef = useRef<string | null>(null);

  const handleChildSignIn = async () => {
    if (!isSupabaseConfigured || !supabase) {
      selectRole("child");
      return;
    }

    if (!childName.trim() || !pin.trim()) {
      setError(t("auth.childAccess.nameAndPinRequired"));
      return;
    }

    setError(null);
    setIsSubmitting(true);
    const normalizedName = childName.trim();
    const normalizedPin = pin.trim();
    const attemptKey = `${normalizedName.toLowerCase()}::${normalizedPin}`;
    lastAttemptRef.current = attemptKey;
    const { data: creds, error: credsError } = await supabase.rpc("get_child_login_credentials", {
      p_child_name: normalizedName,
      p_pin: normalizedPin,
    });
    const loginCreds = Array.isArray(creds) ? creds[0] : null;
    if (credsError || !loginCreds?.login_email || !loginCreds?.login_secret) {
      setIsSubmitting(false);
      setError(credsError ? formatAppError(credsError) : t("auth.childAccess.invalidCredentials"));
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: loginCreds.login_email,
      password: loginCreds.login_secret,
    });
    if (signInError) {
      setIsSubmitting(false);
      setError(formatAppError(signInError));
      return;
    }

    setSuccessToastVisible(true);
    setIsSubmitting(false);
  };

  useEffect(() => {
    if (!isSupabaseConfigured || isSubmitting) {
      return;
    }
    const normalizedName = childName.trim();
    const normalizedPin = pin.trim();
    const isReady = normalizedName.length > 0 && normalizedPin.length === 6;
    if (!isReady) {
      return;
    }
    const nextAttempt = `${normalizedName.toLowerCase()}::${normalizedPin}`;
    if (lastAttemptRef.current === nextAttempt) {
      return;
    }
    void handleChildSignIn();
  }, [childName, pin, isSupabaseConfigured, isSubmitting]);

  useEffect(() => {
    if (pin.trim().length === 6) {
      Keyboard.dismiss();
    }
  }, [pin]);

  useEffect(() => {
    if (!successToastVisible) {
      return;
    }
    const timer = setTimeout(() => {
      setSuccessToastVisible(false);
    }, 1600);
    return () => clearTimeout(timer);
  }, [successToastVisible]);

  return (
    <View style={styles.screen}>
      <View style={[styles.headerWrap, { height: HERO_HEIGHT + insets.top, paddingTop: insets.top }]}>
        <Image
          source={require("../../../assets/child-access-hero.png")}
          style={styles.heroImage}
          resizeMode="cover"
          accessibilityLabel="LearnGate Child Access"
        />
        <Pressable
          style={[styles.backBtn, { top: insets.top + 8 }]}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t("auth.childAccess.goBack")}
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
            <View style={styles.badge}>
              <MaterialCommunityIcons name="shield-check" size={18} color={GREEN} />
              <Text style={styles.badgeText}>{t("auth.childAccess.secureLogin")}</Text>
            </View>

            <Text style={styles.cardTitle}>{t("auth.childAccess.title")}</Text>
            <Text style={styles.cardSubtitle}>{t("auth.childAccess.subtitle")}</Text>

            {successToastVisible ? (
              <View style={styles.successToast}>
                <MaterialCommunityIcons name="check-circle" size={16} color="#15803D" />
                <Text style={styles.successToastText}>{t("auth.childAccess.loggedIn")}</Text>
              </View>
            ) : null}

            {isSupabaseConfigured ? (
              <>
                <View style={styles.field}>
                  <MaterialCommunityIcons name="account-outline" size={22} color={GREEN} style={styles.fieldIcon} />
                  <TextInput
                    style={styles.fieldInput}
                    placeholder={t("auth.childAccess.childNamePlaceholder")}
                    placeholderTextColor="#9CA3AF"
                    value={childName}
                    onChangeText={setChildName}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.field}>
                  <MaterialCommunityIcons name="lock-outline" size={22} color={GREEN} style={styles.fieldIcon} />
                  <TextInput
                    style={styles.fieldInput}
                    placeholder={t("auth.childAccess.pinPlaceholder")}
                    placeholderTextColor="#9CA3AF"
                    value={pin}
                    onChangeText={(value) => setPin(value.replace(/[^0-9]/g, "").slice(0, 6))}
                    keyboardType="number-pad"
                    secureTextEntry={!showPin}
                  />
                  <Pressable
                    onPress={() => setShowPin((v) => !v)}
                    accessibilityRole="button"
                    accessibilityLabel={showPin ? t("auth.childAccess.hidePin") : t("auth.childAccess.showPin")}
                    hitSlop={8}
                  >
                    <MaterialCommunityIcons
                      name={showPin ? "eye-off-outline" : "eye-outline"}
                      size={22}
                      color="#9CA3AF"
                    />
                  </Pressable>
                </View>
              </>
            ) : null}

            <Pressable
              onPress={() => void handleChildSignIn()}
              disabled={isSubmitting}
              style={({ pressed }) => [
                styles.unlockBtn,
                (pressed || isSubmitting) && styles.btnPressed,
                isSubmitting && styles.btnDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel={isSupabaseConfigured ? t("auth.childAccess.unlock") : t("auth.childAccess.continueDemo")}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.unlockLabel}>
                  {isSupabaseConfigured ? t("auth.childAccess.unlock") : t("auth.childAccess.continueDemo")}
                </Text>
              )}
            </Pressable>

            {isSubmitting && isSupabaseConfigured ? (
              <Text style={styles.signingInHint}>{t("auth.childAccess.signingIn")}</Text>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {!isSupabaseConfigured ? (
              <Text style={styles.warning}>
                {t("auth.childAccess.supabaseWarning")}
              </Text>
            ) : null}

            <View style={styles.safetyFooter}>
              <MaterialCommunityIcons name="shield-check-outline" size={16} color={GREEN} />
              <Text style={styles.safetyText}>{t("auth.childAccess.safety")}</Text>
            </View>
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
    marginTop: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  badge: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#E8F5E9",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: GREEN,
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
    marginBottom: 2,
  },
  successToast: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#DCFCE7",
    borderColor: "#BBF7D0",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  successToastText: {
    color: "#15803D",
    fontWeight: "700",
    fontSize: 13,
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
  unlockBtn: {
    backgroundColor: GREEN,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 4,
    minHeight: 52,
    justifyContent: "center",
  },
  unlockLabel: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  signingInHint: {
    textAlign: "center",
    fontSize: 13,
    color: "#6B7280",
    marginTop: -6,
  },
  btnPressed: {
    opacity: 0.9,
  },
  btnDisabled: {
    opacity: 0.75,
  },
  error: {
    color: "#B91C1C",
    fontSize: 14,
    textAlign: "center",
  },
  warning: {
    color: colors.warning,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  safetyFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 6,
    paddingTop: 4,
  },
  safetyText: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
  },
});
