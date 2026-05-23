import { NativeModules, Platform } from "react-native";

export type RawUsageEvent = {
  packageName: string;
  timestampMs: number;
  eventType: number;
};

/** Android UsageEvents: MOVE_TO_FOREGROUND */
export const USAGE_EVENT_FOREGROUND = 1;
/** Android UsageEvents: MOVE_TO_BACKGROUND */
export const USAGE_EVENT_BACKGROUND = 2;
/** Android 10+ ACTIVITY_RESUMED */
export const USAGE_EVENT_ACTIVITY_RESUMED = 23;
/** Android 10+ ACTIVITY_PAUSED */
export const USAGE_EVENT_ACTIVITY_PAUSED = 24;

export function isForegroundUsageEvent(eventType: number): boolean {
  return eventType === USAGE_EVENT_FOREGROUND || eventType === USAGE_EVENT_ACTIVITY_RESUMED;
}

export function isBackgroundUsageEvent(eventType: number): boolean {
  return eventType === USAGE_EVENT_BACKGROUND || eventType === USAGE_EVENT_ACTIVITY_PAUSED;
}

type NativeUsageStats = {
  isUsageAccessGranted: () => Promise<boolean>;
  openUsageAccessSettings: () => void;
  queryUsageEvents: (sinceMs: number) => Promise<RawUsageEvent[]>;
  resolveAppLabel: (packageName: string) => Promise<string>;
};

const native: NativeUsageStats | undefined = NativeModules.LearnGateUsageStats;

export function isUsageStatsAvailable(): boolean {
  return Platform.OS === "android" && native != null;
}

export async function getUsageAccessGranted(): Promise<boolean> {
  if (!native) return false;
  return native.isUsageAccessGranted();
}

export function openUsageAccessSettings(): void {
  native?.openUsageAccessSettings();
}

/** Real app name from the child device (e.g. "YouTube" not "Youtube"). */
export async function resolveAppLabelOnDevice(packageName: string): Promise<string | null> {
  if (!native || !packageName) return null;
  try {
    const label = await native.resolveAppLabel(packageName);
    return typeof label === "string" && label.trim().length > 0 ? label.trim() : null;
  } catch {
    return null;
  }
}

export async function queryUsageEventsSince(sinceMs: number): Promise<RawUsageEvent[]> {
  if (!native) return [];
  const raw = await native.queryUsageEvents(sinceMs);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => ({
      packageName: String(row.packageName ?? ""),
      timestampMs: Number(row.timestampMs ?? 0),
      eventType: Number(row.eventType ?? 0),
    }))
    .filter((row) => row.packageName.length > 0 && row.timestampMs > 0);
}
