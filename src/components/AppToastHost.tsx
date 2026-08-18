import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "react-native-paper";
import { useAppColors } from "@/theme/useAppColors";
import { useAppToast } from "@/store/AppToastContext";

/** Global LearnGate toast — mint pill that sits above the current screen. */
export function AppToastHost() {
  const insets = useSafeAreaInsets();
  const c = useAppColors();
  const { toast, hideToast } = useAppToast();
  const isSuccess = toast?.variant !== "error";

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = setTimeout(hideToast, 4200);
    return () => clearTimeout(timer);
  }, [toast, hideToast]);

  if (!toast) {
    return null;
  }

  return (
    <View
      style={[styles.host, { bottom: Math.max(insets.bottom, 16) + 12 }]}
      pointerEvents="box-none"
      accessibilityLiveRegion="polite"
    >
      <View
        style={[
          styles.toast,
          {
            backgroundColor: isSuccess ? c.surfaceTint : c.insightCardBg,
            borderColor: isSuccess ? c.surfaceTintBorder : c.insightCardBorder,
          },
        ]}
        accessibilityRole="alert"
      >
        <MaterialCommunityIcons
          name={isSuccess ? "check-circle" : "alert-circle-outline"}
          size={18}
          color={isSuccess ? c.primaryDark : c.danger}
        />
        <Text style={[styles.text, { color: isSuccess ? c.primaryDark : c.danger }]}>{toast.message}</Text>
      </View>
    </View>
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
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  text: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
});
