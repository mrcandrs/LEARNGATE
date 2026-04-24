import * as WebBrowser from "expo-web-browser";
import { PaperProvider } from "react-native-paper";
import { AuthProvider } from "./src/store/AuthContext";

WebBrowser.maybeCompleteAuthSession();
import { RootNavigator } from "./src/navigation/RootNavigator";
import { appTheme } from "./src/theme/theme";

export default function App() {
  return (
    <PaperProvider theme={appTheme}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </PaperProvider>
  );
}
