import { MD3LightTheme } from "react-native-paper";
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

export const appTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    background: colors.background,
    surface: colors.card,
  },
};
