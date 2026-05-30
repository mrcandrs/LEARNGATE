import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Portal, Text } from "react-native-paper";

type ParentManageToastProps = {
  message: string;
  variant: "success" | "error";
  visible: boolean;
  onHide: () => void;
  durationMs?: number;
};

export function ParentManageToast({
  message,
  variant,
  visible,
  onHide,
  durationMs = 3200,
}: ParentManageToastProps) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible) {
      return;
    }
    const timer = setTimeout(onHide, durationMs);
    return () => clearTimeout(timer);
  }, [visible, message, durationMs, onHide]);

  if (!visible) {
    return null;
  }

  const isSuccess = variant === "success";

  return (
    <Portal>
      <View
        style={[styles.host, { bottom: Math.max(insets.bottom, 12) + 56 }]}
        pointerEvents="box-none"
        accessibilityLiveRegion="polite"
      >
        <View style={[styles.toast, isSuccess ? styles.success : styles.error]} accessibilityRole="alert">
          <MaterialCommunityIcons
            name={isSuccess ? "check-circle" : "alert-circle-outline"}
            size={18}
            color={isSuccess ? "#15803D" : "#B91C1C"}
          />
          <Text style={[styles.text, isSuccess ? styles.successText : styles.errorText]}>{message}</Text>
        </View>
      </View>
    </Portal>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
    zIndex: 9999,
    elevation: 9999,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  success: {
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  error: {
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  text: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  successText: {
    color: "#15803D",
  },
  errorText: {
    color: "#B91C1C",
  },
});
