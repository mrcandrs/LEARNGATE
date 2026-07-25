/**
 * Kid-friendly offline / cache copy for LearnGate.
 */
export const OFFLINE_MSG = {
  profile:
    "You're offline. Showing your saved profile — it'll update automatically when you're back online.",
  homeTasks:
    "You're offline. Showing your saved tasks — they'll refresh when you're back online.",
  tasks:
    "You're offline. Showing your saved task list — it'll sync when you're back online.",
  action:
    "You're offline right now. Connect to the internet and try again — then your progress can sync.",
  award:
    "Couldn't reach the server. When you're back online, try again so your stars can sync.",
  generic:
    "No internet connection. Your saved data is still here — it'll sync when you're back online.",
} as const;

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
