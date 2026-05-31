import { createNavigationContainerRef } from "@react-navigation/native";

export type RootNavParams = {
  Overview?: undefined;
  Children?: undefined;
  Settings?: undefined;
  Home?: undefined;
  Activities?: undefined;
};

export const navigationRef = createNavigationContainerRef<RootNavParams>();

export function navigateFromNotification(kind: string, _data: Record<string, unknown>) {
  if (!navigationRef.isReady()) {
    return;
  }

  const parentKinds = new Set([
    "task_submitted",
    "task_completed",
    "child_game_milestone",
    "child_app_uninstalled",
    "child_device_offline",
    "parent_insight",
  ]);
  const childKinds = new Set(["task_assigned", "chore_approved"]);

  if (parentKinds.has(kind)) {
    if (kind === "parent_insight" || kind === "child_game_milestone") {
      navigationRef.navigate("Overview");
    } else {
      navigationRef.navigate("Children");
    }
    return;
  }

  if (childKinds.has(kind)) {
    navigationRef.navigate("Home");
  }
}
