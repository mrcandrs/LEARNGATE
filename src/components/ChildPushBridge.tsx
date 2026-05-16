import { useChildTaskAlerts } from "@/hooks/useChildTaskAlerts";
import { initPushNotificationListeners } from "@/services/pushNotifications";
import { useAuth } from "@/store/AuthContext";
import { useEffect } from "react";

/** Wires push listeners + child task alerts for the signed-in child session. */
export function ChildPushBridge() {
  const { appMode } = useAuth();

  useEffect(() => {
    initPushNotificationListeners();
  }, []);

  useChildTaskAlerts(appMode === "child");

  return null;
}
