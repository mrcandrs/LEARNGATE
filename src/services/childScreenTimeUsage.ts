import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_PREFIX = "learngate_child_screen_usage_v1";

type UsageRecord = {
  date: string;
  minutes: number;
};

export function todayDateKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function storageKey(childId: string): string {
  return `${STORAGE_PREFIX}:${childId}`;
}

export async function getTodayUsageMinutes(childId: string): Promise<number> {
  const raw = await AsyncStorage.getItem(storageKey(childId));
  if (!raw) {
    return 0;
  }
  try {
    const record = JSON.parse(raw) as UsageRecord;
    if (record.date !== todayDateKey()) {
      return 0;
    }
    return Math.max(0, Math.round(record.minutes));
  } catch {
    return 0;
  }
}

export async function setTodayUsageMinutes(childId: string, minutes: number): Promise<void> {
  const record: UsageRecord = {
    date: todayDateKey(),
    minutes: Math.max(0, Math.round(minutes)),
  };
  await AsyncStorage.setItem(storageKey(childId), JSON.stringify(record));
}

export async function addTodayUsageMinutes(childId: string, deltaMinutes: number): Promise<number> {
  const current = await getTodayUsageMinutes(childId);
  const next = current + Math.max(0, deltaMinutes);
  await setTodayUsageMinutes(childId, next);
  return next;
}
