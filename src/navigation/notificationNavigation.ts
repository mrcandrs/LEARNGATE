/** Normalize `user_notifications.data` / push `data` for navigation. */
export function normalizeNotificationData(data: Record<string, unknown>) {
  const childId =
    typeof data.child_id === "string"
      ? data.child_id
      : typeof data.childId === "string"
        ? data.childId
        : undefined;

  const rawCategory = data.category ?? data.task_category;
  const category = typeof rawCategory === "string" ? rawCategory.toLowerCase() : "";

  return { childId, category };
}

/** Bumps on each navigation so screens re-apply params when already focused. */
export function notificationNavKey(): number {
  return Date.now();
}
