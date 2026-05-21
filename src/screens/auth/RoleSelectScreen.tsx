import { Dimensions, Image, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { RoleSelectCard } from "@/components/RoleSelectCard";
import { AuthStackParamList } from "@/types/navigation";
import { colors } from "@/theme/theme";

type Props = NativeStackScreenProps<AuthStackParamList, "RoleSelect">;

/** Reference mockup: button + header green */
const HEADER_GREEN = colors.roleSelectGreen;
/** Reference mockup: off-white lower panel (rgb 246,247,236) */
const SHEET_BG = "#F6F7EC";
const SHEET_OVERLAP = 24;

const { width: SCREEN_WIDTH } = Dimensions.get("window");
/** Cropped reference header (no status bar); aspect from build script output */
const HERO_HEIGHT = Math.round(SCREEN_WIDTH * (1174 / 1080));

export function RoleSelectScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <View style={[styles.headerWrap, { height: HERO_HEIGHT + insets.top, paddingTop: insets.top }]}>
        <Image
          source={require("../../../assets/role-select-hero.png")}
          style={styles.heroImage}
          resizeMode="cover"
          accessibilityLabel="LearnGate"
        />
      </View>

      <SafeAreaView style={styles.sheet} edges={["left", "right", "bottom"]}>
        <Text style={styles.heading}>Who is using the app ?</Text>
        <Text style={styles.subheading}>Choose your role to continue</Text>

        <View style={styles.cards}>
          <RoleSelectCard title="Parent" variant="parent" onPress={() => navigation.navigate("ParentLogin")} />
          <RoleSelectCard title="Child" variant="child" onPress={() => navigation.navigate("ChildAccess")} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SHEET_BG,
  },
  headerWrap: {
    width: SCREEN_WIDTH,
    backgroundColor: HEADER_GREEN,
    overflow: "hidden",
  },
  heroImage: {
    width: SCREEN_WIDTH,
    height: "100%",
  },
  sheet: {
    flex: 1,
    backgroundColor: SHEET_BG,
    marginTop: -SHEET_OVERLAP,
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 22,
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1A1A1A",
    textAlign: "center",
    marginBottom: 8,
  },
  subheading: {
    fontSize: 15,
    fontWeight: "500",
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 28,
  },
  cards: {
    gap: 16,
  },
});
