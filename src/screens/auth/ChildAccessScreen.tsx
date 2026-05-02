import { useEffect, useRef, useState } from "react";
import { Keyboard, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text, TextInput } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useAuth } from "@/store/AuthContext";
import { colors, radii, shadows } from "@/theme/theme";
import { supabase } from "@/services/supabase";
import { formatAppError } from "@/utils/errors";

export function ChildAccessScreen() {
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
      setError("Child name and PIN are required.");
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
      setError(credsError ? formatAppError(credsError) : "Invalid child name or PIN.");
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
    // App mode will be resolved by AuthContext via profiles.role.
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
    <ScreenContainer scroll>
      <View style={styles.content}>
        <View style={styles.badge}>
          <MaterialCommunityIcons name="shield-check-outline" size={18} color={colors.primaryDark} />
          <Text variant="labelMedium" style={styles.badgeText}>
            Secure Child Login
          </Text>
        </View>
        <Text variant="headlineLarge" style={styles.title}>
          Child Access
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Enter your child name and parent PIN.
        </Text>
        {successToastVisible ? (
          <View style={styles.successToast}>
            <MaterialCommunityIcons name="check-circle" size={16} color="#15803D" />
            <Text variant="labelMedium" style={styles.successToastText}>
              Logged in successfully
            </Text>
          </View>
        ) : null}

        {isSupabaseConfigured ? (
          <View style={styles.formCard}>
            <TextInput
              label="Child Name"
              mode="outlined"
              value={childName}
              onChangeText={setChildName}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
            />
            <TextInput
              label="Parent PIN (6 digits)"
              mode="outlined"
              value={pin}
              onChangeText={(value) => setPin(value.replace(/[^0-9]/g, "").slice(0, 6))}
              keyboardType="number-pad"
              secureTextEntry={!showPin}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              right={
                <TextInput.Icon
                  icon={showPin ? "eye-off-outline" : "eye-outline"}
                  onPress={() => setShowPin((prev) => !prev)}
                  forceTextInputFocus={false}
                />
              }
            />
          </View>
        ) : null}
        {isSubmitting ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text variant="bodySmall" style={styles.loadingText}>
              Signing in...
            </Text>
          </View>
        ) : null}

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
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#E8F5E9",
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  badgeText: {
    color: colors.primaryDark,
    fontWeight: "700",
  },
  title: {
    color: colors.text,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.subtext,
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
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  successToastText: {
    color: "#15803D",
    fontWeight: "700",
  },
  formCard: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  loadingRow: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  loadingText: {
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
