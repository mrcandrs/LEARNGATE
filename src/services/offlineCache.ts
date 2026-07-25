/**
 * Simplest offline read-cache for the child app.
 * Saves last successful profile + tasks to AsyncStorage so Home/Tasks
 * still show something when the network fails.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ChildProfileRow } from "@/types/child";
import type { TaskRow } from "@/utils/childTaskDisplay";

const PROFILE_KEY = "lg:cache:childProfile";
const tasksKey = (childId: string) => `lg:cache:childTasks:${childId}`;
const homeTasksKey = (childId: string) => `lg:cache:homeTasks:${childId}`;

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures — cache is best-effort.
  }
}

export async function cacheChildProfile(child: ChildProfileRow): Promise<void> {
  await writeJson(PROFILE_KEY, child);
}

export async function readCachedChildProfile(): Promise<ChildProfileRow | null> {
  return readJson<ChildProfileRow>(PROFILE_KEY);
}

export async function cacheChildTasks(childId: string, tasks: TaskRow[]): Promise<void> {
  if (!childId) return;
  await writeJson(tasksKey(childId), tasks);
}

export async function readCachedChildTasks(childId: string): Promise<TaskRow[] | null> {
  if (!childId) return null;
  return readJson<TaskRow[]>(tasksKey(childId));
}

/** Home only shows a short pending list — cache that separately. */
export async function cacheHomeTasks(childId: string, tasks: TaskRow[]): Promise<void> {
  if (!childId) return;
  await writeJson(homeTasksKey(childId), tasks);
}

export async function readCachedHomeTasks(childId: string): Promise<TaskRow[] | null> {
  if (!childId) return null;
  return readJson<TaskRow[]>(homeTasksKey(childId));
}
