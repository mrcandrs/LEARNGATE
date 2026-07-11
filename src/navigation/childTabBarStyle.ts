import type { ViewStyle } from "react-native";

export const CHILD_TAB_BAR_HEIGHT = 72;

export function childTabBarVisibleStyle(surfaceColor: string): ViewStyle {
  return {
    display: "flex",
    backgroundColor: surfaceColor,
    borderTopWidth: 0,
    height: CHILD_TAB_BAR_HEIGHT,
    paddingTop: 8,
    paddingBottom: 10,
    elevation: 12,
  };
}

export const childTabBarHiddenStyle: ViewStyle = {
  display: "none",
  height: 0,
};
