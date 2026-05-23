import { NativeModules, Platform } from "react-native";

/** True when this APK includes LearnGate custom native modules (not Expo Go). */
export function hasLearnGateNativeModules(): boolean {
  if (Platform.OS !== "android") return false;
  const modules = NativeModules as Record<string, unknown>;
  return Boolean(modules.LearnGateBlocker && modules.LearnGateChildLock && modules.LearnGateUsageStats);
}
