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
  "com.transsion.xoslauncher",
  "com.transsion.hilauncher",
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
  // System dialogs / utilities that surface as "apps" in Usage Stats but have no real UI to block.
  "com.android.captiveportallogin",
  "com.android.vpndialogs",
  "com.android.traceur",
  "com.android.dynsystem",
  "com.android.documentsui",
  "com.android.printspooler",
  "com.android.keychain",
  "com.android.certinstaller",
  "com.android.carrierconfig",
  "com.android.emergency",
  "com.android.cellbroadcastreceiver",
  "com.android.storagemanager",
  "com.android.wallpapercropper",
  "com.android.wallpaper.livepicker",
  "com.android.companiondevicemanager",
  "com.android.settings.intelligence",
  "com.google.android.gms.location.history",
  "com.google.android.gsf",
  "com.google.android.ext.services",
  "com.google.android.as",
  "com.google.android.overlay.modules",
  "com.transsion.resolver",
  "com.transsion.tranresolver",
  "com.transsion.systemui",
  "com.android.intent.resolver",
]);

const IGNORED_PREFIXES = [
  "com.android.launcher",
  "com.android.systemui",
  "com.android.inputmethod",
  "com.google.android.inputmethod",
  "com.samsung.android.app.telephonyui",
  "com.android.server",
  "com.android.internal",
  "com.android.providers",
  "com.android.bluetooth",
  "com.android.nfc",
  "com.android.phone",
  "com.android.mtp",
  "com.android.wallpaper",
  "com.android.settings.",
  "com.samsung.android.settings",
  "com.coloros.settings",
  "com.miui.settings",
];

const IGNORED_SUBSTRINGS = [
  "permissioncontroller",
  "launcher3",
  "quickstep",
  "recents",
  ".gms",
  "googlequicksearchbox",
  "xoslauncher",
  "hilauncher",
  "captiveportal",
  "vpndialog",
  ".resolver",
  "resolveractivity",
  "tranresolver",
  ".screenshot",
  "screenshotservice",
  "wallpaperpicker",
  "setupwizard",
  ".overlay",
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
