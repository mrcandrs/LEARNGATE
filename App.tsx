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

WebBrowser.maybeCompleteAuthSession();
import { RootNavigator } from "./src/navigation/RootNavigator";
import { appTheme } from "./src/theme/theme";

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
    <PaperProvider theme={appTheme}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </PaperProvider>
  );
}
