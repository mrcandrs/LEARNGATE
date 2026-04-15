export type UserRole = "parent" | "child";

export type AppMode = "auth" | "parent" | "child";

export type ParentStat = {
  label: string;
  value: string;
};

export type ChildTask = {
  id: string;
  title: string;
  category: string;
  reward: string;
  actionLabel: string;
};
