import { Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "@/store/AuthContext";

export function ParentHeaderLogout() {
  const { signOut } = useAuth();

  return (
    <Pressable
      onPress={() => void signOut()}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Sign out"
    >
      <MaterialCommunityIcons name="logout" size={24} color="#FFFFFF" />
    </Pressable>
  );
}
