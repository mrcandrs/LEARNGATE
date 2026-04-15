import { Button } from "react-native-paper";

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  mode?: "contained" | "outlined" | "text";
  disabled?: boolean;
};

export function PrimaryButton({ label, onPress, mode = "contained", disabled }: PrimaryButtonProps) {
  return (
    <Button mode={mode} onPress={onPress} disabled={disabled} style={{ marginTop: 8 }}>
      {label}
    </Button>
  );
}
