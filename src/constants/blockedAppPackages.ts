import type { ComponentProps } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export type BlockableIconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

export type BlockableAppGroup = {
  /** Stable id for UI / keys */
  slug: string;
  label: string;
  packages: readonly string[];
  icon: BlockableIconName;
};

/** One parent toggle expands to multiple real Android packages (regions, lite vs full). */
export const BLOCKABLE_APP_GROUPS: readonly BlockableAppGroup[] = [
  { slug: "facebook", label: "Facebook", icon: "facebook", packages: ["com.facebook.katana", "com.facebook.lite"] },
  {
    slug: "tiktok",
    label: "TikTok",
    icon: "music-note",
    packages: ["com.zhiliaoapp.musically", "com.ss.android.ugc.trill", "com.zhiliaoapp.musically.go"],
  },
  { slug: "instagram", label: "Instagram", icon: "instagram", packages: ["com.instagram.android", "com.instagram.lite"] },
  { slug: "youtube", label: "YouTube", icon: "youtube", packages: ["com.google.android.youtube"] },
  { slug: "chrome", label: "Chrome", icon: "google-chrome", packages: ["com.android.chrome"] },
] as const;

const LABEL_BY_PACKAGE = (() => {
  const map: Record<string, string> = {};
  for (const g of BLOCKABLE_APP_GROUPS) {
    for (const p of g.packages) map[p] = g.label;
  }
  return map;
})();

export function labelForBlockedPackage(packageName: string): string {
  return LABEL_BY_PACKAGE[packageName] ?? packageName;
}

/** Unique readable names for blocked packages (e.g. child settings list). */
export function blockedPackagesToLabels(packages: string[]): string[] {
  const seen = new Map<string, true>();
  const out: string[] = [];
  for (const p of packages) {
    const lbl = labelForBlockedPackage(p);
    if (!seen.has(lbl)) {
      seen.set(lbl, true);
      out.push(lbl);
    }
  }
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

export function isGroupFullySelected(blockedPackages: string[], group: BlockableAppGroup): boolean {
  return group.packages.some((p) => blockedPackages.includes(p));
}

export function toggleBlockedGroup(blockedPackages: string[], group: BlockableAppGroup): string[] {
  const selected = isGroupFullySelected(blockedPackages, group);
  const set = new Set(blockedPackages);
  if (selected) {
    for (const p of group.packages) set.delete(p);
  } else {
    for (const p of group.packages) set.add(p);
  }
  return Array.from(set);
}
