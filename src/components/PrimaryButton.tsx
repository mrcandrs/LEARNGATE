import { StyleSheet } from "react-native";
import { Button } from "react-native-paper";

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  mode?: "contained" | "outlined" | "text";
  disabled?: boolean;
  loading?: boolean;
};

export function PrimaryButton({ label, onPress, mode = "contained", disabled, loading }: PrimaryButtonProps) {
  return (
    <Button
      mode={mode}
      onPress={onPress}
      loading={loading}
      disabled={disabled || loading}
      style={[mode === "text" ? styles.textButton : styles.defaultButton]}
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
