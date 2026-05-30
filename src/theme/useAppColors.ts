import { useMemo } from "react";
import { useThemeMode } from "@/store/ThemeModeContext";
import { getAppColors, type AppColors } from "@/theme/theme";

export function useAppColors(): AppColors {
  const { mode, appearance } = useThemeMode();
  return useMemo(() => getAppColors(mode, appearance), [mode, appearance]);
}
