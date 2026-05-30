/**
 * LearnGate notification matrix — push (device) + in-app bell share the same events
 * (mirrored from notification_outbox via step-v-in-app-notifications.sql).
 */

export type NotificationAudience = "parent" | "child";

export type NotificationCatalogEntry = {
  kind: string;
  audience: NotificationAudience;
  title: string;
  description: string;
  /** Typical trigger in the app */
  trigger: string;
  push: boolean;
  inApp: boolean;
};

export const NOTIFICATION_CATALOG: NotificationCatalogEntry[] = [
  {
    kind: "task_assigned",
    audience: "child",
    title: "New task",
    description: "Parent assigned a learning, exercise, or chore task.",
    trigger: "Parent creates a task in Manage Children",
    push: true,
    inApp: true,
  },
  {
    kind: "chore_approved",
    audience: "child",
    title: "Chore approved",
    description: "Parent approved a submitted chore.",
    trigger: "Parent approves a chore submission",
    push: true,
    inApp: true,
  },
  {
    kind: "task_submitted",
    audience: "parent",
    title: "Submission to review",
    description: "Child submitted a camera chore for review.",
    trigger: "Child submits a chore with photo evidence",
    push: true,
    inApp: true,
  },
  {
    kind: "task_completed",
    audience: "parent",
    title: "Task completed",
    description: "Child finished a task (learning, exercise, or chore without review).",
    trigger: "Child completes a task",
    push: true,
    inApp: true,
  },
  {
    kind: "child_game_milestone",
    audience: "parent",
    title: "Learning update",
    description: "Child earned stars from a standalone learning game (not a linked task).",
    trigger: "Child finishes a game from the Games tab",
    push: true,
    inApp: true,
  },
  {
    kind: "parent_insight",
    audience: "parent",
    title: "Insight for you",
    description: "Weekly-style coaching tip based on the child's activity.",
    trigger: "After task completion when patterns match (debounced 24h per child)",
    push: true,
    inApp: true,
  },
  {
    kind: "child_app_uninstalled",
    audience: "parent",
    title: "App may be uninstalled",
    description: "Child push token is invalid — app removed or data cleared.",
    trigger: "Push health check or failed delivery to child token",
    push: true,
    inApp: true,
  },
  {
    kind: "child_device_offline",
    audience: "parent",
    title: "Device quiet",
    description: "Child has not checked in recently.",
    trigger: "Scheduled presence check (if step N cron is enabled)",
    push: false,
    inApp: true,
  },
];

export function catalogForAudience(audience: NotificationAudience): NotificationCatalogEntry[] {
  return NOTIFICATION_CATALOG.filter((e) => e.audience === audience);
}
