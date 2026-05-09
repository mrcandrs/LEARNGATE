import AsyncStorage from "@react-native-async-storage/async-storage";
import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from "react";
import { AppThemeMode, createAppTheme } from "@/theme/theme";

type ThemeModeContextValue = {
  mode: AppThemeMode;
  setMode: (mode: AppThemeMode) => void;
  theme: ReturnType<typeof createAppTheme>;
};

const STORAGE_KEY = "learngate.themeMode.v1";
const ThemeModeContext = createContext<ThemeModeContextValue | undefined>(undefined);

export function ThemeModeProvider({ children }: PropsWithChildren) {
  const [mode, setMode] = useState<AppThemeMode>("mint");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!active || !raw) return;
        if (raw === "mint" || raw === "sunset" || raw === "midnight") {
          setMode(raw);
        }
      } catch {
        // ignore
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    void AsyncStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const value = useMemo<ThemeModeContextValue>(() => ({ mode, setMode, theme: createAppTheme(mode) }), [mode]);
  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode() {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error("useThemeMode must be used within ThemeModeProvider.");
  return ctx;
}

