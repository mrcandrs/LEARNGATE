import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "learngate.parent.selectedChildId.v1";

export async function loadParentSelectedChildId(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

export async function saveParentSelectedChildId(childId: string | null): Promise<void> {
  try {
    if (!childId) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return;
    }
    await AsyncStorage.setItem(STORAGE_KEY, childId);
  } catch {
    // ignore
  }
}

export function resolveParentSelectedChildId(
  availableIds: string[],
  currentId: string | null,
  storedId: string | null
): string | null {
  if (currentId && availableIds.includes(currentId)) {
    return currentId;
  }
  if (storedId && availableIds.includes(storedId)) {
    return storedId;
  }
  return availableIds[0] ?? null;
}
