import { StyleProp, ViewStyle } from "react-native";
import { Button } from "react-native-paper";
import type { ComponentProps } from "react";
import { useAppColors } from "@/theme/useAppColors";

type IconName = ComponentProps<typeof Button>["icon"];

type Props = {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  /** `critical` is a deeper red — use for irreversible actions like account deletion. */
  tone?: "danger" | "critical";
  mode?: "contained" | "outlined";
};

const CRITICAL_RED = "#991B1B";

/** Contained button with explicit destructive colors — visible in light and dark mode. */
export function DestructiveButton({
  label,
  onPress,
  style,
  loading,
  disabled,
  icon,
  tone = "danger",
  mode = "contained",
}: Props) {
  const c = useAppColors();
  const isCritical = tone === "critical";
  const fill = isCritical ? CRITICAL_RED : c.danger;

  if (mode === "outlined") {
    return (
      <Button
        mode="outlined"
        textColor={fill}
        onPress={onPress}
        loading={loading}
        disabled={disabled || loading}
        icon={icon}
        style={[{ borderColor: fill, borderWidth: 1.5 }, style]}
      >
        {label}
      </Button>
    );
  }

  return (
    <Button
      mode="contained"
      buttonColor={fill}
      textColor={c.onDanger}
      onPress={onPress}
      loading={loading}
      disabled={disabled || loading}
      icon={icon}
      style={style}
    >
      {label}
    </Button>
  );
}
