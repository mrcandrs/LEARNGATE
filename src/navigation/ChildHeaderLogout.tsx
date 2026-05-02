import { Pressable, StyleSheet, View } from "react-native";
import { useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Dialog, Portal, Text } from "react-native-paper";
import { useAuth } from "@/store/AuthContext";

export function ChildHeaderLogout() {
  const { signOut } = useAuth();
  const [confirmVisible, setConfirmVisible] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setConfirmVisible(true)}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
      >
        <MaterialCommunityIcons name="logout" size={24} color="#FFFFFF" />
      </Pressable>

      <Portal>
        <Dialog visible={confirmVisible} onDismiss={() => setConfirmVisible(false)}>
          <Dialog.Title>Sign out</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">Are you sure you want to log out?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <View style={styles.actions}>
              <Pressable onPress={() => setConfirmVisible(false)} hitSlop={8}>
                <Text style={styles.cancel}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setConfirmVisible(false);
                  void signOut();
                }}
                hitSlop={8}
              >
                <Text style={styles.logout}>Log out</Text>
              </Pressable>
            </View>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 18,
    paddingHorizontal: 8,
    paddingBottom: 6,
  },
  cancel: {
    color: "#64748B",
    fontWeight: "700",
  },
  logout: {
    color: "#B91C1C",
    fontWeight: "800",
  },
});
