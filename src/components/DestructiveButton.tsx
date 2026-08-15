import { StyleProp, ViewStyle } from "react-native";
import { Button } from "react-native-paper";
import { useAppColors } from "@/theme/useAppColors";

type Props = {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  loading?: boolean;
  disabled?: boolean;
};

/** Contained button with explicit destructive colors — visible in light and dark mode. */
export function DestructiveButton({ label, onPress, style, loading, disabled }: Props) {
  const c = useAppColors();

  return (
    <Button
      mode="contained"
      buttonColor={c.danger}
      textColor={c.onDanger}
      onPress={onPress}
      loading={loading}
      disabled={disabled || loading}
      style={style}
    >
      {label}
    </Button>
  );
}
