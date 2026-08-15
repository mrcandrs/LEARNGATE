import { tRuntime } from "@/i18n/runtimeLocale";

/**
 * Kid-friendly offline / cache copy for LearnGate.
 */
export const OFFLINE_MSG = {
  get profile() {
    return tRuntime("offline.profile");
  },
  get homeTasks() {
    return tRuntime("offline.homeTasks");
  },
  get tasks() {
    return tRuntime("offline.tasks");
  },
  get action() {
    return tRuntime("offline.action");
  },
  get award() {
    return tRuntime("offline.award");
  },
  get generic() {
    return tRuntime("offline.generic");
  },
};

export function isLikelyOfflineError(error: unknown): boolean {
  if (error == null) return false;
  const raw =
    typeof error === "string"
      ? error
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);
  const msg = raw.toLowerCase();
  return (
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("internet") ||
    msg.includes("offline") ||
    msg.includes("failed to fetch") ||
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("connection") ||
    msg.includes("unreachable") ||
    msg.includes("socket")
  );
}

/** Prefer a friendly offline line; otherwise fall back to formatAppError result. */
export function offlineAwareError(error: unknown, fallback: string): string {
  if (isLikelyOfflineError(error)) return OFFLINE_MSG.action;
  return fallback;
}
