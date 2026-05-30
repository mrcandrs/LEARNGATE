import AsyncStorage from "@react-native-async-storage/async-storage";
import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from "react";
import { AppAppearance, AppThemeMode, createAppTheme } from "@/theme/theme";

type ThemeModeContextValue = {
  mode: AppThemeMode;
  setMode: (mode: AppThemeMode) => void;
  appearance: AppAppearance;
  setAppearance: (appearance: AppAppearance) => void;
  theme: ReturnType<typeof createAppTheme>;
};

const MODE_STORAGE_KEY = "learngate.themeMode.v1";
const APPEARANCE_STORAGE_KEY = "learngate.appearance.v1";
const ThemeModeContext = createContext<ThemeModeContextValue | undefined>(undefined);

export function ThemeModeProvider({ children }: PropsWithChildren) {
  const [mode, setMode] = useState<AppThemeMode>("mint");
  const [appearance, setAppearance] = useState<AppAppearance>("light");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [rawMode, rawAppearance] = await Promise.all([
          AsyncStorage.getItem(MODE_STORAGE_KEY),
          AsyncStorage.getItem(APPEARANCE_STORAGE_KEY),
        ]);
        if (!active) return;
        if (rawMode === "mint" || rawMode === "sunset" || rawMode === "midnight") {
          setMode(rawMode);
        }
        if (rawAppearance === "light" || rawAppearance === "dark") {
          setAppearance(rawAppearance);
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
    void AsyncStorage.setItem(MODE_STORAGE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    void AsyncStorage.setItem(APPEARANCE_STORAGE_KEY, appearance);
  }, [appearance]);

  const value = useMemo<ThemeModeContextValue>(
    () => ({
      mode,
      setMode,
      appearance,
      setAppearance,
      theme: createAppTheme(mode, appearance),
    }),
    [mode, appearance]
  );

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode() {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error("useThemeMode must be used within ThemeModeProvider.");
  return ctx;
}
