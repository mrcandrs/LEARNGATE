import { PropsWithChildren } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useAppColors } from "@/theme/useAppColors";
import { radii } from "@/theme/theme";

type Props = PropsWithChildren<{
  visible: boolean;
  onDismiss: () => void;
}>;

/** Modal shell: backdrop tap dismisses; sheet does not steal wheel scroll gestures. */
export function PickerModalSheet({ visible, onDismiss, children }: Props) {
  const c = useAppColors();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View style={[styles.sheet, { backgroundColor: c.card }]}>{children}</View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  sheet: {
    borderRadius: radii.lg,
    padding: 20,
    gap: 16,
  },
});
