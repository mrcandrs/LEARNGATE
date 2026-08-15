import { MD3DarkTheme, MD3LightTheme } from "react-native-paper";
import { configureFonts } from "react-native-paper";
import { Platform } from "react-native";

/** Legacy static tokens (mint light). Prefer `useAppColors()` in UI. */
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
  brandLime: "#C5E84D",
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
export type AppAppearance = "light" | "dark";

export type AppColors = {
  primary: string;
  primaryDark: string;
  background: string;
  card: string;
  text: string;
  subtext: string;
  border: string;
  warning: string;
  info: string;
  heroGradient: readonly [string, string, string];
  surfaceTint: string;
  surfaceTintBorder: string;
  insightCardBg: string;
  insightCardBorder: string;
  progressTrack: string;
  sectionIconBg: string;
  stepperValueBg: string;
  stepperButtonBg: string;
  locationStatusBg: string;
  locationStatusBorder: string;
  mutedSurface: string;
  pinIcon: string;
  danger: string;
  onDanger: string;
};

const lightPalettes: Record<AppThemeMode, AppColors> = {
  mint: {
    primary: "#4CAF50",
    primaryDark: "#2E7D32",
    background: "#F7FAF8",
    card: "#FFFFFF",
    text: "#1F2937",
    subtext: "#6B7280",
    border: "#E5E7EB",
    warning: "#F59E0B",
    info: "#2196F3",
    heroGradient: ["#81C784", "#43A047", "#1B5E20"],
    surfaceTint: "#F0FDF4",
    surfaceTintBorder: "#BBF7D0",
    insightCardBg: "#FFFBEB",
    insightCardBorder: "#FDE68A",
    progressTrack: "#E8F5E9",
    sectionIconBg: "#E8F5E9",
    stepperValueBg: "#E8F5E9",
    stepperButtonBg: "#FFFFFF",
    locationStatusBg: "#F0FDF4",
    locationStatusBorder: "#4CAF50",
    mutedSurface: "#F8FAFC",
    pinIcon: "#EAB308",
    danger: "#DC2626",
    onDanger: "#FFFFFF",
  },
  sunset: {
    primary: "#EA580C",
    primaryDark: "#C2410C",
    background: "#FFF7ED",
    card: "#FFFFFF",
    text: "#1F2937",
    subtext: "#7C4A2D",
    border: "#F0C9A8",
    warning: "#F59E0B",
    info: "#EA580C",
    heroGradient: ["#FDBA74", "#EA580C", "#9A3412"],
    surfaceTint: "#FFF7ED",
    surfaceTintBorder: "#FDBA74",
    insightCardBg: "#FFF7ED",
    insightCardBorder: "#FDBA74",
    progressTrack: "#FFEDD5",
    sectionIconBg: "#FFEDD5",
    stepperValueBg: "#FFEDD5",
    stepperButtonBg: "#FFFFFF",
    locationStatusBg: "#FFF7ED",
    locationStatusBorder: "#EA580C",
    mutedSurface: "#FFF1E6",
    pinIcon: "#EAB308",
    danger: "#DC2626",
    onDanger: "#FFFFFF",
  },
  midnight: {
    primary: "#4F46E5",
    primaryDark: "#3730A3",
    background: "#EEF2FF",
    card: "#FFFFFF",
    text: "#1F2937",
    subtext: "#46506B",
    border: "#CCD1FA",
    warning: "#F59E0B",
    info: "#0284C7",
    heroGradient: ["#A5B4FC", "#4F46E5", "#312E81"],
    surfaceTint: "#EEF2FF",
    surfaceTintBorder: "#A5B4FC",
    insightCardBg: "#EEF2FF",
    insightCardBorder: "#C7D2FE",
    progressTrack: "#E0E7FF",
    sectionIconBg: "#E0E7FF",
    stepperValueBg: "#E0E7FF",
    stepperButtonBg: "#FFFFFF",
    locationStatusBg: "#EEF2FF",
    locationStatusBorder: "#4F46E5",
    mutedSurface: "#E6E9FF",
    pinIcon: "#EAB308",
    danger: "#DC2626",
    onDanger: "#FFFFFF",
  },
};

const darkPalettes: Record<AppThemeMode, AppColors> = {
  mint: {
    primary: "#66BB6A",
    primaryDark: "#A5D6A7",
    background: "#0C1210",
    card: "#1A221E",
    text: "#F3F4F6",
    subtext: "#9CA3AF",
    border: "#2D3D35",
    warning: "#FBBF24",
    info: "#60A5FA",
    heroGradient: ["#388E3C", "#1B5E20", "#0A1F12"],
    surfaceTint: "#1B3D2A",
    surfaceTintBorder: "#2D5A3D",
    insightCardBg: "#1F1A10",
    insightCardBorder: "#4D4420",
    progressTrack: "#1B3D2A",
    sectionIconBg: "#1B3D2A",
    stepperValueBg: "#1B3D2A",
    stepperButtonBg: "#1A221E",
    locationStatusBg: "#1B3D2A",
    locationStatusBorder: "#66BB6A",
    mutedSurface: "#141C18",
    pinIcon: "#FACC15",
    danger: "#F87171",
    onDanger: "#FFFFFF",
  },
  sunset: {
    primary: "#FB923C",
    primaryDark: "#FDBA74",
    background: "#1A1008",
    card: "#261A10",
    text: "#FEF3C7",
    subtext: "#D6B89A",
    border: "#4D3520",
    warning: "#FBBF24",
    info: "#FB923C",
    heroGradient: ["#C2410C", "#7C2D12", "#431407"],
    surfaceTint: "#3D2210",
    surfaceTintBorder: "#7C4A2D",
    insightCardBg: "#261A10",
    insightCardBorder: "#7C4A2D",
    progressTrack: "#3D2210",
    sectionIconBg: "#3D2210",
    stepperValueBg: "#3D2210",
    stepperButtonBg: "#261A10",
    locationStatusBg: "#3D2210",
    locationStatusBorder: "#FB923C",
    mutedSurface: "#201408",
    pinIcon: "#FACC15",
    danger: "#F87171",
    onDanger: "#FFFFFF",
  },
  midnight: {
    primary: "#818CF8",
    primaryDark: "#C7D2FE",
    background: "#0C1020",
    card: "#161B2E",
    text: "#EEF2FF",
    subtext: "#A5B4FC",
    border: "#2E3655",
    warning: "#FBBF24",
    info: "#38BDF8",
    heroGradient: ["#4F46E5", "#312E81", "#1E1B4B"],
    surfaceTint: "#1E2440",
    surfaceTintBorder: "#4F46E5",
    insightCardBg: "#161B2E",
    insightCardBorder: "#4F46E5",
    progressTrack: "#1E2440",
    sectionIconBg: "#1E2440",
    stepperValueBg: "#1E2440",
    stepperButtonBg: "#161B2E",
    locationStatusBg: "#1E2440",
    locationStatusBorder: "#818CF8",
    mutedSurface: "#12162A",
    pinIcon: "#FACC15",
    danger: "#F87171",
    onDanger: "#FFFFFF",
  },
};

const paperPalettes: Record<
  AppThemeMode,
  {
    primary: string;
    secondary: string;
    tertiary: string;
    outline: string;
    outlineVariant: string;
  }
> = {
  mint: {
    primary: "#4CAF50",
    secondary: "#0EA5A3",
    tertiary: "#F59E0B",
    outline: "#B7D7C0",
    outlineVariant: "#D4E6DA",
  },
  sunset: {
    primary: "#EA580C",
    secondary: "#F59E0B",
    tertiary: "#DC2626",
    outline: "#F0C9A8",
    outlineVariant: "#F7DDC8",
  },
  midnight: {
    primary: "#4F46E5",
    secondary: "#0284C7",
    tertiary: "#7C3AED",
    outline: "#B7BDF6",
    outlineVariant: "#CCD1FA",
  },
};

export function getAppColors(mode: AppThemeMode, appearance: AppAppearance): AppColors {
  return appearance === "dark" ? darkPalettes[mode] : lightPalettes[mode];
}

export function createAppTheme(mode: AppThemeMode, appearance: AppAppearance) {
  const palette = paperPalettes[mode];
  const app = getAppColors(mode, appearance);
  const base = appearance === "dark" ? MD3DarkTheme : MD3LightTheme;

  return {
    ...base,
    colors: {
      ...base.colors,
      primary: palette.primary,
      secondary: palette.secondary,
      tertiary: palette.tertiary,
      background: app.background,
      surface: app.card,
      surfaceVariant: app.surfaceTint,
      onSurface: app.text,
      onSurfaceVariant: app.subtext,
      outline: app.border,
      outlineVariant: palette.outlineVariant,
    },
    fonts: configureFonts({ config: { fontFamily: "Poppins_400Regular" } }),
  };
}

export const appTheme = createAppTheme("mint", "light");
