import { PaperProvider } from "react-native-paper";
import { AuthProvider } from "./src/store/AuthContext";
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
