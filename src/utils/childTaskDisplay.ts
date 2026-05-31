import type { ComponentProps } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { AppColors } from "@/theme/theme";

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

export function taskSubtitle(task: TaskRow): string {
  if (task.category === "chore" && task.requires_camera) {
    return "Camera verification needed";
  }
  if (task.category === "exercise") {
    return "Reps required · Physical activity";
  }
  if (task.category === "learning") {
    return "Learning game · Tap to play";
  }
  if (task.status === "submitted") {
    return "Waiting for parent review";
  }
  return "Tap to complete";
}
