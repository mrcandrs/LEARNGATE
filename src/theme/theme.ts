import { MD3LightTheme } from "react-native-paper";

export const colors = {
  primary: "#36C251",
  primaryDark: "#1E9E36",
  background: "#F7FAF8",
  card: "#FFFFFF",
  text: "#1F2937",
  subtext: "#6B7280",
  border: "#E5E7EB",
  warning: "#F59E0B",
  info: "#60A5FA",
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
