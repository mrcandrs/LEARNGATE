import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "@/theme/theme";

type Props = {
  title: string;
  variant: "parent" | "child";
  onPress: () => void;
};

const GREEN = colors.roleSelectGreen;

export function RoleSelectCard({ title, variant, onPress }: Props) {
  const isParent = variant === "parent";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        isParent ? styles.cardParent : styles.cardChild,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={[styles.iconCircle, isParent ? styles.iconCircleParent : styles.iconCircleChild]}>
        <MaterialCommunityIcons
          name={isParent ? "account-supervisor" : "human-child"}
          size={26}
          color={isParent ? GREEN : "#FFFFFF"}
        />
      </View>
      <Text style={[styles.title, isParent ? styles.titleParent : styles.titleChild]}>{title}</Text>
      <MaterialCommunityIcons name="chevron-right" size={28} color={isParent ? "#FFFFFF" : GREEN} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 64,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  cardParent: {
    backgroundColor: GREEN,
  },
  cardChild: {
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: GREEN,
  },
  pressed: {
    opacity: 0.92,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleParent: {
    backgroundColor: "#FFFFFF",
  },
  iconCircleChild: {
    backgroundColor: GREEN,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
  },
  titleParent: {
    color: "#FFFFFF",
  },
  titleChild: {
    color: GREEN,
  },
});
