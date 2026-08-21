import { StyleProp, StyleSheet, TextStyle } from "react-native";
import { Button } from "react-native-paper";

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  mode?: "contained" | "outlined" | "text";
  disabled?: boolean;
  loading?: boolean;
  labelStyle?: StyleProp<TextStyle>;
};

export function PrimaryButton({
  label,
  onPress,
  mode = "contained",
  disabled,
  loading,
  labelStyle,
}: PrimaryButtonProps) {
  return (
    <Button
      mode={mode}
      onPress={onPress}
      loading={loading}
      disabled={disabled || loading}
      style={[mode === "text" ? styles.textButton : styles.defaultButton]}
      labelStyle={labelStyle}
    >
      {label}
    </Button>
  );
}

const styles = StyleSheet.create({
  defaultButton: {
    marginTop: 8,
  },
  textButton: {
    marginTop: 0,
    marginVertical: 0,
  },
});
