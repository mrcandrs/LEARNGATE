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
  { slug: "snapchat", label: "Snapchat", icon: "ghost", packages: ["com.snapchat.android"] },
  { slug: "whatsapp", label: "WhatsApp", icon: "whatsapp", packages: ["com.whatsapp", "com.whatsapp.w4b"] },
  {
    slug: "messenger",
    label: "Messenger",
    icon: "facebook-messenger",
    packages: ["com.facebook.orca", "com.facebook.mlite"],
  },
  { slug: "twitter", label: "X (Twitter)", icon: "twitter", packages: ["com.twitter.android"] },
  { slug: "discord", label: "Discord", icon: "message-text", packages: ["com.discord"] },
  { slug: "roblox", label: "Roblox", icon: "gamepad-variant", packages: ["com.roblox.client"] },
  { slug: "minecraft", label: "Minecraft", icon: "gamepad-square", packages: ["com.mojang.minecraftpe"] },
  { slug: "spotify", label: "Spotify", icon: "spotify", packages: ["com.spotify.music"] },
  { slug: "netflix", label: "Netflix", icon: "netflix", packages: ["com.netflix.mediaclient"] },
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
  "com.reddit.frontpage": "Reddit",
  "com.facebook.barcelona": "Facebook",
  "com.gotyme.android": "GoTyme",
  "com.gotyme.bank": "GoTyme",
  "com.transsion.appmanager": "Phone Manager",
  "com.transsion.phonemaster": "Phone Manager",
  "com.android.camera": "Camera",
  "com.android.camera2": "Camera",
  "com.google.android.GoogleCamera": "Camera",
  "com.mediatek.camera": "Camera",
  "com.sec.android.app.camera": "Camera",
};

/** Substring / pattern hints when the exact package id is unknown or OEM-specific. */
const PACKAGE_LABEL_PATTERNS: readonly { match: RegExp; label: string }[] = [
  { match: /reddit|\.frontpage$/i, label: "Reddit" },
  { match: /facebook\.barcelona|\.barcelona$/i, label: "Facebook" },
  { match: /gotyme/i, label: "GoTyme" },
  { match: /appmanager|phonemaster/i, label: "Phone Manager" },
  { match: /\.orca$|messenger/i, label: "Messenger" },
  { match: /instagram/i, label: "Instagram" },
  { match: /whatsapp/i, label: "WhatsApp" },
  { match: /youtube/i, label: "YouTube" },
  { match: /tiktok|musically|\.trill$/i, label: "TikTok" },
  { match: /snapchat/i, label: "Snapchat" },
  { match: /spotify/i, label: "Spotify" },
  { match: /netflix/i, label: "Netflix" },
  { match: /roblox/i, label: "Roblox" },
  { match: /minecraft/i, label: "Minecraft" },
  { match: /discord/i, label: "Discord" },
  { match: /chrome/i, label: "Chrome" },
  { match: /\.camera2?$|googlecamera|mediatek\.camera/i, label: "Camera" },
  { match: /google\.android\.apps\.messaging/i, label: "Messages" },
  { match: /google\.android\.gm/i, label: "Gmail" },
  { match: /google\.android\.apps\.photos/i, label: "Photos" },
  { match: /google\.android\.apps\.maps/i, label: "Maps" },
  { match: /vending$/i, label: "Play Store" },
];

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
  "com.discord": "message-text",
  "com.twitter.android": "twitter",
  "com.reddit.frontpage": "reddit",
};

function labelFromPackagePatterns(packageName: string): string | null {
  const lower = packageName.toLowerCase();
  for (const { match, label } of PACKAGE_LABEL_PATTERNS) {
    if (match.test(lower)) return label;
  }
  return null;
}

function hasCatalogLabel(packageName: string): boolean {
  const key = packageName.trim();
  const lower = key.toLowerCase();
  return Boolean(
    LABEL_BY_PACKAGE[key] ??
      LABEL_BY_PACKAGE[lower] ??
      EXTRA_PACKAGE_LABELS[key] ??
      EXTRA_PACKAGE_LABELS[lower] ??
      labelFromPackagePatterns(key)
  );
}

export function labelForPackage(packageName: string): string {
  const key = packageName.trim();
  const lower = key.toLowerCase();
  return (
    LABEL_BY_PACKAGE[key] ??
    LABEL_BY_PACKAGE[lower] ??
    EXTRA_PACKAGE_LABELS[key] ??
    EXTRA_PACKAGE_LABELS[lower] ??
    labelFromPackagePatterns(key) ??
    humanizePackage(key)
  );
}

/** Prefer a friendly label on the parent dashboard (never show raw package ids when avoidable). */
export function displayAppUsageLabel(appLabel: string | null | undefined, packageName: string): string {
  const catalog = labelForPackage(packageName);
  const normalized = appLabel?.trim();

  if (!normalized || looksLikePackageId(normalized) || normalized === packageName) {
    return catalog;
  }

  // Stored labels are often auto-humanized package segments ("Frontpage", "Barcelona", "Android").
  if (isAutoGeneratedLabel(normalized, packageName)) {
    return catalog;
  }

  // When we know the package id, prefer the catalog over a stale or generic stored name.
  if (hasCatalogLabel(packageName)) {
    return catalog;
  }

  return normalized;
}

function isAutoGeneratedLabel(label: string, packageName: string): boolean {
  const humanized = humanizePackage(packageName);
  if (label.toLowerCase() === humanized.toLowerCase()) {
    return true;
  }
  const segment = packageName.toLowerCase().split(".").pop() ?? "";
  if (segment && label.toLowerCase() === segment) {
    return true;
  }
  if (label.toLowerCase() === "android" && packageName.includes(".")) {
    return true;
  }
  return false;
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
  const parts = lower.split(".").filter(Boolean);
  const segment = parts[parts.length - 1] ?? lower;

  const knownSuffixes: Record<string, string> = {
    orca: "Messenger",
    katana: "Facebook",
    musically: "TikTok",
    trill: "TikTok",
    mediaclient: "Netflix",
    xoslauncher: "Home",
    hilauncher: "Home",
    frontpage: "Reddit",
    barcelona: "Facebook",
    appmanager: "Phone Manager",
    phonemaster: "Phone Manager",
  };

  if (segment === "android" && parts.length >= 2) {
    const parent = parts[parts.length - 2];
    const parentLabels: Record<string, string> = {
      instagram: "Instagram",
      chrome: "Chrome",
    };
    if (parentLabels[parent]) {
      return parentLabels[parent];
    }
  }

  if (knownSuffixes[segment]) {
    return knownSuffixes[segment];
  }
  if (!segment) return packageName;
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export type BlockedAppDisplayItem = {
  key: string;
  label: string;
  icon: BlockableIconName;
};

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

/** Blocked apps for child settings list (grouped labels + icons). */
export function blockedAppsForDisplay(blockedPackages: string[]): BlockedAppDisplayItem[] {
  const items: BlockedAppDisplayItem[] = [];
  const covered = new Set<string>();

  for (const group of BLOCKABLE_APP_GROUPS) {
    if (isGroupFullySelected(blockedPackages, group)) {
      items.push({ key: group.slug, label: group.label, icon: group.icon });
      for (const pkg of group.packages) {
        covered.add(pkg);
      }
    }
  }

  for (const pkg of blockedPackages) {
    if (covered.has(pkg)) continue;
    items.push({ key: pkg, label: labelForPackage(pkg), icon: iconForPackage(pkg) });
  }

  return items.sort((a, b) => a.label.localeCompare(b.label));
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

/** All packages that already have a curated group tile (so we don't list them twice). */
const CURATED_PACKAGES = (() => {
  const set = new Set<string>();
  for (const g of BLOCKABLE_APP_GROUPS) {
    for (const p of g.packages) set.add(p);
  }
  return set;
})();

/** True when a package is already covered by a curated group toggle. */
export function isCuratedPackage(packageName: string): boolean {
  return CURATED_PACKAGES.has(packageName);
}

/** True when an individual package is in the blocked list. */
export function isPackageBlocked(blockedPackages: string[], packageName: string): boolean {
  return blockedPackages.includes(packageName);
}

/** Add/remove a single raw package (used for apps outside the curated catalog). */
export function toggleBlockedPackage(blockedPackages: string[], packageName: string): string[] {
  const set = new Set(blockedPackages);
  if (set.has(packageName)) {
    set.delete(packageName);
  } else {
    set.add(packageName);
  }
  return Array.from(set);
}
