import { Pressable } from "react-native";
import { Text } from "react-native-paper";
import { useAppColors } from "@/theme/useAppColors";

type Props = {
  label: string;
  onPress: () => void;
  color?: string;
};

export function LegalLinkButton({ label, onPress, color }: Props) {
  const c = useAppColors();
  return (
    <Pressable onPress={onPress} accessibilityRole="link" hitSlop={6}>
      <Text style={{ color: color ?? c.primaryDark, fontWeight: "700", textDecorationLine: "underline" }}>
        {label}
      </Text>
    </Pressable>
  );
}
