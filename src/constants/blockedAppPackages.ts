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

const ICON_BY_PACKAGE = (() => {
  const map: Record<string, BlockableIconName> = {};
  for (const g of BLOCKABLE_APP_GROUPS) {
    for (const p of g.packages) map[p] = g.icon;
  }
  return map;
})();

/** Extra packages shown on the parent usage dashboard (not only block-list apps). */
const EXTRA_PACKAGE_LABELS: Record<string, string> = {
  "com.android.settings": "Settings",
  "com.google.android.apps.messaging": "Messages",
  "com.android.vending": "Play Store",
  "com.google.android.gm": "Gmail",
  "com.google.android.apps.photos": "Photos",
  "com.snapchat.android": "Snapchat",
  "com.whatsapp": "WhatsApp",
  "com.spotify.music": "Spotify",
  "com.netflix.mediaclient": "Netflix",
  "com.roblox.client": "Roblox",
  "com.microsoft.minecraft": "Minecraft",
  "com.sec.android.app.launcher": "Samsung Home",
  "com.google.android.apps.nexuslauncher": "Home",
  "com.facebook.orca": "Messenger",
  "com.facebook.mlite": "Messenger Lite",
  "com.transsion.XOSLauncher": "Home",
  "com.transsion.hilauncher": "Home",
  "com.android.chrome": "Chrome",
  "com.google.android.apps.maps": "Maps",
  "com.google.android.calendar": "Calendar",
  "com.google.android.dialer": "Phone",
  "com.google.android.contacts": "Contacts",
  "com.google.android.calculator": "Calculator",
  "com.google.android.apps.docs": "Google Docs",
  "com.google.android.youtube.kids": "YouTube Kids",
  "com.discord": "Discord",
  "com.twitter.android": "X",
  "com.zhiliaoapp.musically": "TikTok",
  "com.ss.android.ugc.trill": "TikTok",
  "com.instagram.android": "Instagram",
  "com.facebook.katana": "Facebook",
  "com.facebook.lite": "Facebook Lite",
};

const EXTRA_PACKAGE_ICONS: Record<string, BlockableIconName> = {
  "com.google.android.apps.messaging": "message-text-outline",
  "com.android.vending": "google-play",
  "com.google.android.gm": "gmail",
  "com.google.android.apps.photos": "image-multiple",
  "com.snapchat.android": "ghost",
  "com.whatsapp": "whatsapp",
  "com.spotify.music": "spotify",
  "com.netflix.mediaclient": "netflix",
  "com.roblox.client": "gamepad-variant",
  "com.microsoft.minecraft": "gamepad-variant-outline",
  "com.facebook.orca": "facebook-messenger",
  "com.facebook.mlite": "facebook-messenger",
  "com.transsion.XOSLauncher": "home-outline",
  "com.transsion.hilauncher": "home-outline",
  "com.google.android.apps.maps": "map-marker-outline",
  "com.google.android.calendar": "calendar-outline",
  "com.google.android.dialer": "phone-outline",
  "com.discord": "discord",
  "com.twitter.android": "twitter",
};

export function labelForPackage(packageName: string): string {
  const key = packageName.trim();
  const lower = key.toLowerCase();
  return (
    LABEL_BY_PACKAGE[key] ??
    LABEL_BY_PACKAGE[lower] ??
    EXTRA_PACKAGE_LABELS[key] ??
    EXTRA_PACKAGE_LABELS[lower] ??
    humanizePackage(key)
  );
}

/** Prefer a friendly label on the parent dashboard (never show raw package ids when avoidable). */
export function displayAppUsageLabel(appLabel: string | null | undefined, packageName: string): string {
  const normalized = appLabel?.trim();
  if (normalized && normalized !== packageName && !looksLikePackageId(normalized)) {
    return normalized;
  }
  return labelForPackage(packageName);
}

function looksLikePackageId(value: string): boolean {
  return /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i.test(value);
}

/** Icon for parent dashboard (device APK icons are not available on the parent phone). */
export function iconForPackage(packageName: string): BlockableIconName {
  return ICON_BY_PACKAGE[packageName] ?? EXTRA_PACKAGE_ICONS[packageName] ?? "application-outline";
}

export function labelForBlockedPackage(packageName: string): string {
  return labelForPackage(packageName);
}

function humanizePackage(packageName: string): string {
  const lower = packageName.toLowerCase();
  const knownSuffixes: Record<string, string> = {
    orca: "Messenger",
    katana: "Facebook",
    musically: "TikTok",
    trill: "TikTok",
    mediaclient: "Netflix",
    xoslauncher: "Home",
    hilauncher: "Home",
  };
  const segment = lower.split(".").pop() ?? lower;
  if (knownSuffixes[segment]) {
    return knownSuffixes[segment];
  }
  if (!segment) return packageName;
  return segment.charAt(0).toUpperCase() + segment.slice(1);
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
