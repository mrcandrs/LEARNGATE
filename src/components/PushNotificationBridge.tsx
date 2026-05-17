import { useEffect } from "react";
import { useChildTaskAlerts } from "@/hooks/useChildTaskAlerts";
import { useEnsurePushToken } from "@/hooks/useEnsurePushToken";
import { useParentChildPushHealthCheck } from "@/hooks/useParentChildPushHealthCheck";
import { initPushNotificationListeners } from "@/services/pushNotifications";
import { useAuth } from "@/store/AuthContext";

/** Push listeners for parent + child; uninstall health checks only on parent schedule. */
export function PushNotificationBridge() {
  const { appMode } = useAuth();
  const signedIn = appMode === "parent" || appMode === "child";

  useEffect(() => {
    initPushNotificationListeners();
  }, []);

  useEnsurePushToken(signedIn);
  useChildTaskAlerts(appMode === "child");
  useParentChildPushHealthCheck(appMode === "parent");

  return null;
}
