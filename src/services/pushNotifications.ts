import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "@/services/supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  // Remote push tokens are not available in Expo Go on SDK 53+ (Android).
  if (Constants.appOwnership === "expo") {
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    return null;
  }

  let token: string;
  try {
    token = (await Notifications.getExpoPushTokenAsync()).data;
  } catch {
    return null;
  }

  // Android requires a channel for heads-up behavior.
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  return token;
}

export async function upsertMyPushToken(expoPushToken: string) {
  if (!supabase) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("push_tokens").upsert(
    {
      user_id: user.id,
      token: expoPushToken,
      platform: Platform.OS,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "token" }
  );
}

export async function notifySilenceLocal(params: { title: string; body: string }) {
  await Notifications.scheduleNotificationAsync({
    content: { title: params.title, body: params.body },
    trigger: null,
  });
}

