/** Packages that are OS shell / setup — not meaningful "apps the child used". */
const IGNORED_EXACT = new Set([
  "android",
  "com.pipsjacob.learngate",
  "com.android.systemui",
  "com.android.shell",
  "com.android.intentresolver",
  "com.android.packageinstaller",
  "com.google.android.packageinstaller",
  "com.android.providers.settings",
  "com.google.android.setupwizard",
  "com.google.android.apps.nexuslauncher",
  "com.sec.android.app.launcher",
  "com.miui.home",
  "com.huawei.android.launcher",
  "com.oppo.launcher",
  "com.oneplus.launcher",
  "com.android.settings",
  "com.google.android.permissioncontroller",
  "com.android.permissioncontroller",
  "app.lawnchair",
  "app.lawnchair.debug",
  "app.lawnchair.nightly",
  "com.lawnchair.lawnchair",
  "ch.deletescape.lawnchair",
  "ch.deletescape.lawnchair.plah",
  "ch.deletescape.lawnchair.dev",
  "com.google.android.googlequicksearchbox",
  "com.google.android.gms",
  "com.google.android.gms.ui",
  "com.google.android.gms.persistent",
  "com.google.android.gms.unstable",
  "com.android.vending",
]);

const IGNORED_PREFIXES = [
  "com.android.launcher",
  "com.android.systemui",
  "com.android.inputmethod",
  "com.google.android.inputmethod",
  "com.samsung.android.app.telephonyui",
];

const IGNORED_SUBSTRINGS = [
  "permissioncontroller",
  "launcher3",
  "quickstep",
  "recents",
  ".gms",
  "googlequicksearchbox",
];

/**
 * True if this package should appear on the parent "recent apps" list or be synced from Usage Stats.
 */
export function isReportableUserApp(packageName: string): boolean {
  const pkg = packageName.trim().toLowerCase();
  if (!pkg) return false;
  if (IGNORED_EXACT.has(pkg)) return false;
  if (IGNORED_PREFIXES.some((p) => pkg.startsWith(p))) return false;
  if (IGNORED_SUBSTRINGS.some((s) => pkg.includes(s))) return false;
  if (pkg.endsWith(".launcher") || pkg.includes(".launcher.")) return false;
  return true;
}

export function filterReportableUsageRows<T extends { package_name: string }>(rows: T[]): T[] {
  return rows.filter((row) => isReportableUserApp(row.package_name));
}
