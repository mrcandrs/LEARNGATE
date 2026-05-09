import * as WebBrowser from "expo-web-browser";
import { PaperProvider } from "react-native-paper";
import {
  Poppins_400Regular,
  Poppins_400Regular_Italic,
  Poppins_500Medium,
  Poppins_500Medium_Italic,
  Poppins_600SemiBold,
  Poppins_600SemiBold_Italic,
  Poppins_700Bold,
  Poppins_700Bold_Italic,
  useFonts,
} from "@expo-google-fonts/poppins";
import { AuthProvider } from "./src/store/AuthContext";
import { AudioGuidanceProvider } from "./src/store/AudioGuidanceContext";
import { ThemeModeProvider, useThemeMode } from "./src/store/ThemeModeContext";

WebBrowser.maybeCompleteAuthSession();
import { RootNavigator } from "./src/navigation/RootNavigator";

function AppShell() {
  const { theme } = useThemeMode();
  return (
    <PaperProvider theme={theme}>
      <AudioGuidanceProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </AudioGuidanceProvider>
    </PaperProvider>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_400Regular_Italic,
    Poppins_500Medium,
    Poppins_500Medium_Italic,
    Poppins_600SemiBold,
    Poppins_600SemiBold_Italic,
    Poppins_700Bold,
    Poppins_700Bold_Italic,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ThemeModeProvider>
      <AppShell />
    </ThemeModeProvider>
  );
}
