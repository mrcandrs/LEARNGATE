import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { navigateFromNotification } from "@/navigation/navigationRef";
import { supabase } from "@/services/supabase";

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as Record<string, unknown> | undefined;
    const kind = typeof data?.kind === "string" ? data.kind : "";
    const isSilentHealthPing = kind === "token_health_ping";

    return {
      shouldShowAlert: !isSilentHealthPing,
      shouldShowBanner: !isSilentHealthPing,
      shouldShowList: !isSilentHealthPing,
      shouldPlaySound: !isSilentHealthPing,
      shouldSetBadge: false,
    };
  },
});

let listenersInitialized = false;

/** Call once at app start so remote pushes are logged and shown in foreground. */
export function initPushNotificationListeners() {
  if (listenersInitialized) {
    return;
  }
  listenersInitialized = true;

  Notifications.addNotificationReceivedListener((notification) => {
    if (__DEV__) {
      console.log("[push] received", notification.request.content.title, notification.request.content.body);
    }
  });

  Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as Record<string, unknown> | undefined;
    const kind = typeof data?.kind === "string" ? data.kind : "";
    if (kind && kind !== "token_health_ping") {
      navigateFromNotification(kind, data ?? {});
    }
    if (__DEV__) {
      console.log("[push] opened", data);
    }
  });
}

export type PushRegistrationResult = {
  ok: boolean;
  message: string;
  token?: string;
};

function resolveExpoProjectId(): string | null {
  const fromConfig =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  return typeof fromConfig === "string" && fromConfig.length > 0 ? fromConfig : null;
}

async function ensureAndroidNotificationChannels() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Family updates",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  await Notifications.setNotificationChannelAsync("tasks", {
    name: "Tasks & family updates",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

export async function registerForPushNotifications(): Promise<PushRegistrationResult> {
  if (Constants.appOwnership === "expo") {
    return {
      ok: false,
      message: "Push tokens are not available in Expo Go on Android. Use a development build (expo run:android).",
    };
  }

  const projectId = resolveExpoProjectId();
  if (!projectId) {
    return {
      ok: false,
      message:
        "Missing Expo project ID. Run `npx eas init` in the project folder, then rebuild the app (or set EXPO_PUBLIC_EAS_PROJECT_ID in .env).",
    };
  }

  const { status: existingStatus, canAskAgain } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    const hint =
      canAskAgain === false
        ? " Open Android Settings → Apps → LearnGate → Notifications and turn them on."
        : "";
    return {
      ok: false,
      message: `Notification permission not granted (${finalStatus}).${hint}`,
    };
  }

  await ensureAndroidNotificationChannels();

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return { ok: true, message: "Push token obtained.", token: data };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    if (__DEV__) {
      console.warn("[push] getExpoPushTokenAsync failed:", detail);
    }
    if (/FirebaseApp|FCM|google-services/i.test(detail)) {
      return {
        ok: false,
        message:
          "Firebase is not set up on Android. Add google-services.json from Firebase (package com.pipsjacob.learngate), place it in the project root, copy to android/app/, rebuild with expo run:android, then upload FCM credentials with eas credentials. See https://docs.expo.dev/push-notifications/fcm-credentials/",
      };
    }
    if (/SERVICE_NOT_AVAILABLE|SERVICE_UNAVAILABLE|ExecutionException/i.test(detail)) {
      return {
        ok: false,
        message:
          "Google Play Services could not provide a push token on this device. Use a phone or emulator with Google Play, sign in to a Google account, and ensure google-services.json plus FCM credentials are configured—then rebuild the app. The in-app notification bell still works without device push.",
      };
    }
    return {
      ok: false,
      message: `Could not get Expo push token: ${detail}`,
    };
  }
}

/** Register permission + Expo token and save to Supabase for the signed-in profile (parent or child). */
export async function registerAndSavePushToken(): Promise<PushRegistrationResult> {
  const registration = await registerForPushNotifications();
  if (!registration.ok || !registration.token) {
    return registration;
  }

  const save = await upsertMyPushToken(registration.token);
  if (!save.ok) {
    return { ok: false, message: save.message, token: registration.token };
  }

  return {
    ok: true,
    message: "Push notifications enabled and token saved.",
    token: registration.token,
  };
}

/** Ask the server to verify child push tokens and notify parent if a child app was removed. */
export async function requestChildPushHealthCheck(): Promise<void> {
  if (!supabase) {
    return;
  }
  const { error } = await supabase.rpc("request_child_push_health_check");
  if (error && __DEV__) {
    console.warn("[push] request_child_push_health_check:", error.message);
  }
}

/** True when the signed-in user has a row in push_tokens (required for remote alerts). */
export async function hasMyPushToken(): Promise<boolean> {
  if (!supabase) {
    return false;
  }
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return false;
  }
  const { data, error } = await supabase
    .from("push_tokens")
    .select("token")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  return !error && Boolean(data?.token);
}

export async function upsertMyPushToken(expoPushToken: string): Promise<{ ok: boolean; message: string }> {
  if (!supabase) {
    return { ok: false, message: "Supabase is not configured." };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, message: "Not signed in — cannot save push token." };
  }

  const { error } = await supabase.rpc("upsert_push_token", {
    p_token: expoPushToken,
    p_platform: Platform.OS,
  });

  if (error) {
    if (__DEV__) {
      console.warn("[push] upsert_push_token failed:", error.message);
    }
    const hint =
      error.message.includes("row-level security") || error.code === "42501"
        ? " Run supabase/step-i-push-tokens-fix-rls.sql in the Supabase SQL Editor."
        : "";
    return { ok: false, message: `Could not save token: ${error.message}${hint}` };
  }

  return { ok: true, message: "Token saved." };
}

/** On-device test — proves notification permission and channels work (no server). */
export async function showDeviceTestNotification(): Promise<void> {
  await notifySilenceLocal({
    title: "LEARNGATE device test",
    body: "If you see this, this phone can show notifications.",
  });
}

/** Queue a task_completed outbox row for the signed-in parent (requires step-u SQL). */
export async function enqueueParentTestPush(): Promise<{ ok: boolean; message: string }> {
  if (!supabase) {
    return { ok: false, message: "Supabase is not configured." };
  }
  const { data, error } = await supabase.rpc("enqueue_parent_test_push");
  if (error) {
    const hint = error.message.includes("enqueue_parent_test_push")
      ? " Run supabase/step-u-parent-test-push.sql in the Supabase SQL Editor."
      : "";
    return { ok: false, message: `${error.message}${hint}` };
  }
  return {
    ok: true,
    message: `Test push queued (outbox #${data ?? "?"}). Put the app in the background and wait a few seconds.`,
  };
}

export async function notifySilenceLocal(params: { title: string; body: string }) {
  await ensureAndroidNotificationChannels();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: params.title,
      body: params.body,
      sound: true,
      ...(Platform.OS === "android" ? { channelId: "tasks" } : {}),
    },
    trigger: null,
  });
}

export async function showTaskAssignedNotification(taskTitle: string) {
  await notifySilenceLocal({
    title: "New task",
    body: `${taskTitle} was added for you.`,
  });
}
