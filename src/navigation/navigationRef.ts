import { CommonActions } from "@react-navigation/native";
import { createNavigationContainerRef } from "@react-navigation/native";
import { notificationNavKey, normalizeNotificationData } from "@/navigation/notificationNavigation";
import type { ChildTabParamList, ParentTabParamList } from "@/types/navigation";

export const navigationRef = createNavigationContainerRef<ParentTabParamList & ChildTabParamList>();

function runWhenReady(action: () => void) {
  if (navigationRef.isReady()) {
    action();
    return;
  }
  const unsubscribe = navigationRef.addListener("state", () => {
    if (navigationRef.isReady()) {
      unsubscribe();
      action();
    }
  });
}

function navigateParent<T extends keyof ParentTabParamList>(
  tab: T,
  params: ParentTabParamList[T]
) {
  // @ts-expect-error — parent vs child tab lists are mutually exclusive at runtime
  navigationRef.navigate(tab, params);
}

function navigateChildHome(screen: "TasksList" | "HomeMain") {
  navigationRef.dispatch(
    CommonActions.navigate({
      name: "Home",
      params: {
        screen,
        params: { navKey: notificationNavKey() },
      },
    })
  );
}

function navigateChildActivities(segment: "games" | "movement") {
  navigationRef.dispatch(
    CommonActions.navigate({
      name: "Activities",
      params: {
        screen: "ActivitiesMain",
        params: { segment, navKey: notificationNavKey() },
      },
    })
  );
}

/**
 * Navigate to the screen that matches the notification kind.
 * Uses tab/stack route params so target screens react on focus (including same-tab taps).
 */
export function navigateFromNotification(kind: string, data: Record<string, unknown>) {
  const { childId, category } = normalizeNotificationData(data);
  const navKey = notificationNavKey();

  const go = () => {
    if (!navigationRef.isReady()) {
      return;
    }

    switch (kind) {
      case "task_submitted":
        navigateParent("Children", { childId, focusSubmissions: true, navKey });
        return;

      case "task_completed":
      case "child_game_milestone":
        navigateParent("Overview", { childId, navKey });
        return;

      case "child_app_uninstalled":
      case "child_device_offline":
        navigateParent("Children", { childId, navKey });
        return;

      case "parent_insight":
        navigateParent("Overview", { childId, expandInsights: true, navKey });
        return;

      case "app_unlock_requested":
        navigateParent("Overview", { childId, focusUnlockRequests: true, navKey });
        return;

      case "app_unlock_expired":
        navigateChildHome("HomeMain");
        return;

      case "task_assigned":
        if (category === "learning") {
          navigateChildActivities("games");
          return;
        }
        if (category === "exercise") {
          navigateChildActivities("movement");
          return;
        }
        navigateChildHome("TasksList");
        return;

      case "chore_approved":
        navigateChildHome("TasksList");
        return;

      default:
        if (__DEV__) {
          console.warn("[notifications] no navigation for kind:", kind);
        }
    }
  };

  runWhenReady(go);
}
