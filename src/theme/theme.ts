import { MD3LightTheme } from "react-native-paper";
import { configureFonts } from "react-native-paper";
import { Platform } from "react-native";

/** Wireframe-aligned tokens (parent green, child accents). */
export const colors = {
  primary: "#4CAF50",
  primaryDark: "#2E7D32",
  background: "#F7FAF8",
  card: "#FFFFFF",
  text: "#1F2937",
  subtext: "#6B7280",
  border: "#E5E7EB",
  warning: "#F59E0B",
  info: "#2196F3",
  streak: "#FF9800",
  streakLight: "#FFB74D",
  parentHeader: "#4CAF50",
  /** Matches app icon / splash background (lime). */
  brandLime: "#C5E84D",
  /** Role select mockup — header + Parent/Child buttons. */
  roleSelectGreen: "#5CB85C",
};

export const radii = {
  sm: 10,
  md: 16,
  lg: 22,
  pill: 999,
};

export const shadows = {
  card: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
    },
    android: { elevation: 2 },
    default: {},
  }),
};

export type AppThemeMode = "mint" | "sunset" | "midnight";

const themeModeColors: Record<
  AppThemeMode,
  {
    primary: string;
    secondary: string;
    tertiary: string;
    background: string;
    surface: string;
    surfaceVariant: string;
    outline: string;
    outlineVariant: string;
    onSurfaceVariant: string;
  }
> = {
  mint: {
    primary: "#4CAF50",
    secondary: "#0EA5A3",
    tertiary: "#F59E0B",
    background: "#F7FAF8",
    surface: "#FFFFFF",
    surfaceVariant: "#ECFDF3",
    outline: "#B7D7C0",
    outlineVariant: "#D4E6DA",
    onSurfaceVariant: "#4B5563",
  },
  sunset: {
    primary: "#EA580C",
    secondary: "#F59E0B",
    tertiary: "#DC2626",
    background: "#FFF7ED",
    surface: "#FFFFFF",
    surfaceVariant: "#FFF1E6",
    outline: "#F0C9A8",
    outlineVariant: "#F7DDC8",
    onSurfaceVariant: "#7C4A2D",
  },
  midnight: {
    primary: "#4F46E5",
    secondary: "#0284C7",
    tertiary: "#7C3AED",
    background: "#EEF2FF",
    surface: "#FFFFFF",
    surfaceVariant: "#E6E9FF",
    outline: "#B7BDF6",
    outlineVariant: "#CCD1FA",
    onSurfaceVariant: "#46506B",
  },
};

export function createAppTheme(mode: AppThemeMode) {
  const palette = themeModeColors[mode];
  return {
    ...MD3LightTheme,
    colors: {
      ...MD3LightTheme.colors,
      primary: palette.primary,
      secondary: palette.secondary,
      tertiary: palette.tertiary,
      background: palette.background,
      surface: palette.surface,
      surfaceVariant: palette.surfaceVariant,
      outline: palette.outline,
      outlineVariant: palette.outlineVariant,
      onSurfaceVariant: palette.onSurfaceVariant,
    },
    fonts: configureFonts({ config: { fontFamily: "Poppins_400Regular" } }),
  };
}

export const appTheme = createAppTheme("mint");
