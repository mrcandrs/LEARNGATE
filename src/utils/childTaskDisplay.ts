import type { ComponentProps } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { AppColors } from "@/theme/theme";
import type { TranslateFn } from "@/i18n/helpers";

export type ChildTaskCategory = "learning" | "exercise" | "chore";

export type TaskRow = {
  id: string;
  child_id?: string;
  title: string;
  category: ChildTaskCategory;
  xp_reward: number;
  requires_camera: boolean;
  status: "pending" | "in_progress" | "submitted" | "approved" | "rejected" | "completed";
  description: string | null;
  created_at?: string;
  updated_at?: string;
  completed_at?: string | null;
};

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

export function taskCategoryIcon(category: ChildTaskCategory): IconName {
  if (category === "learning") return "book-open-variant";
  if (category === "exercise") return "run";
  return "broom";
}

export function taskCategoryTint(category: ChildTaskCategory, c?: AppColors): string {
  if (c) {
    if (category === "learning") return c.surfaceTint;
    if (category === "exercise") return c.insightCardBg;
    return c.sectionIconBg;
  }
  if (category === "learning") return "#DCFCE7";
  if (category === "exercise") return "#FFEDD5";
  return "#E0E7FF";
}

export function taskSubtitle(task: TaskRow, t: TranslateFn): string {
  if (task.category === "chore" && task.requires_camera) {
    return t("child.task.cameraNeeded");
  }
  if (task.category === "exercise") {
    let reps: number | null = null;
    if (task.description) {
      try {
        const parsed = JSON.parse(task.description) as { targetReps?: number };
        if (typeof parsed?.targetReps === "number" && parsed.targetReps > 0) {
          reps = parsed.targetReps;
        }
      } catch {
        // ignore non-JSON descriptions
      }
    }
    return reps != null
      ? t("child.task.repsCamera", { reps })
      : t("child.task.repsRequired");
  }
  if (task.category === "learning") {
    return t("child.task.learningGame");
  }
  if (task.status === "submitted") {
    return t("child.task.waitingReview");
  }
  return t("child.task.tapComplete");
}

export function taskListSubtitle(task: TaskRow, t: TranslateFn): string {
  if (task.category === "learning") {
    return t("child.task.learningStars", { stars: task.xp_reward });
  }
  if (task.category === "exercise") {
    return taskSubtitle(task, t);
  }
  if (task.requires_camera) {
    return t("child.task.choreCamera");
  }
  return t("child.task.choreStars", { stars: task.xp_reward });
}

export function taskActionLabel(task: TaskRow, t: TranslateFn): string {
  if (task.category === "learning") {
    return t("common.play");
  }
  if (task.category === "exercise") {
    return t("common.start");
  }
  if (task.requires_camera && task.status === "submitted") {
    return t("child.task.waiting");
  }
  if (task.requires_camera) {
    return t("child.task.takePhoto");
  }
  return t("common.complete");
}
