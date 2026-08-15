import { Pressable, StyleSheet, View } from "react-native";
import { useMemo, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Dialog, Portal, Text } from "react-native-paper";
import { useAuth } from "@/store/AuthContext";
import { useAppColors } from "@/theme/useAppColors";
import { useLocale } from "@/store/LocaleContext";

export function ChildHeaderLogout() {
  const { signOut } = useAuth();
  const c = useAppColors();
  const { t } = useLocale();
  const styles = useMemo(() => createStyles(c), [c]);
  const [confirmVisible, setConfirmVisible] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setConfirmVisible(true)}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={t("common.signOut")}
      >
        <MaterialCommunityIcons name="logout" size={24} color="#FFFFFF" />
      </Pressable>

      <Portal>
        <Dialog visible={confirmVisible} onDismiss={() => setConfirmVisible(false)} style={{ backgroundColor: c.card }}>
          <Dialog.Title style={{ color: c.text }}>{t("common.signOut")}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ color: c.text }}>
              {t("common.logOutConfirm")}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <View style={styles.actions}>
              <Pressable onPress={() => setConfirmVisible(false)} hitSlop={8}>
                <Text style={styles.cancel}>{t("common.cancel")}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setConfirmVisible(false);
                  void signOut();
                }}
                hitSlop={8}
              >
                <Text style={styles.logout}>{t("common.logOut")}</Text>
              </Pressable>
            </View>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

function createStyles(c: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    actions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 18,
      paddingHorizontal: 8,
      paddingBottom: 6,
    },
    cancel: {
      color: c.subtext,
      fontWeight: "700",
    },
    logout: {
      color: c.danger,
      fontWeight: "800",
    },
  });
}
