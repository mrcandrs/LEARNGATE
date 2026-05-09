import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Chip, Dialog, Portal, Switch, Text } from "react-native-paper";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useAuth } from "@/store/AuthContext";
import { colors, radii, shadows } from "@/theme/theme";
import { useAudioGuidance } from "@/store/AudioGuidanceContext";
import { useThemeMode } from "@/store/ThemeModeContext";
import { useChildProfile } from "@/hooks/useChildProfile";
import { supabase } from "@/services/supabase";
import { formatAppError } from "@/utils/errors";

export function ChildSettingsScreen() {
  const { signOut } = useAuth();
  const audio = useAudioGuidance();
  const { child, refresh } = useChildProfile();
  const themeMode = useThemeMode();
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onToggleAudio = async (next: boolean) => {
    audio.setEnabled(next);
    if (!supabase || !child) return;
    const { error: updateError } = await supabase.from("children").update({ audio_guide_enabled: next }).eq("id", child.id);
    if (updateError) {
      setError(formatAppError(updateError));
      return;
    }
    await refresh(true);
  };

  return (
    <ScreenContainer scroll>
      <View style={styles.card}>
        <Text variant="titleMedium" style={styles.title}>
          Appearance
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Pick your app look.
        </Text>
        <View style={styles.chipRow}>
          <Chip selected={themeMode.mode === "mint"} onPress={() => themeMode.setMode("mint")}>
            Mint
          </Chip>
          <Chip selected={themeMode.mode === "sunset"} onPress={() => themeMode.setMode("sunset")}>
            Sunset
          </Chip>
          <Chip selected={themeMode.mode === "midnight"} onPress={() => themeMode.setMode("midnight")}>
            Midnight
          </Chip>
        </View>
      </View>

      <View style={styles.card}>
        <Text variant="titleMedium" style={styles.title}>
          Audio Guide
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Turn spoken prompts on or off.
        </Text>
        <View style={styles.row}>
          <Text variant="bodyLarge" style={styles.rowLabel}>
            Enabled
          </Text>
          <Switch value={child?.audio_guide_enabled ?? audio.enabled} onValueChange={(value) => void onToggleAudio(value)} />
        </View>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.card}>
        <Text variant="titleMedium" style={styles.title}>
          Account
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Manage child account settings.
        </Text>
        <Button mode="contained" onPress={() => setConfirmVisible(true)} style={styles.logoutButton} contentStyle={styles.logoutButtonContent}>
          Log Out
        </Button>
      </View>

      <Portal>
        <Dialog visible={confirmVisible} onDismiss={() => setConfirmVisible(false)}>
          <Dialog.Title>Log out</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">Are you sure you want to log out?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button mode="text" onPress={() => setConfirmVisible(false)}>
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={() => {
                setConfirmVisible(false);
                void signOut();
              }}
              style={styles.dialogLogout}
            >
              Log Out
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: radii.md,
    padding: 16,
    gap: 10,
    ...shadows.card,
  },
  title: {
    color: colors.text,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.subtext,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  rowLabel: {
    color: colors.text,
  },
  logoutButton: {
    backgroundColor: "#B91C1C",
    marginTop: 8,
  },
  logoutButtonContent: {
    minHeight: 46,
  },
  dialogLogout: {
    backgroundColor: "#B91C1C",
  },
  errorText: {
    color: "#B91C1C",
  },
});

