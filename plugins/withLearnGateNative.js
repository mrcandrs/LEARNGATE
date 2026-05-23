const fs = require("fs");
const path = require("path");
const {
  withAndroidManifest,
  withMainApplication,
  withDangerousMod,
  AndroidConfig,
} = require("@expo/config-plugins");

const JAVA_PKG_DIR = path.join("com", "pipsjacob", "learngate");
const NATIVE_SRC = path.join("native-android", "java", "com", "pipsjacob", "learngate");

function copyNativeSources(projectRoot, platformRoot) {
  const destDir = path.join(platformRoot, "app", "src", "main", "java", JAVA_PKG_DIR);
  fs.mkdirSync(destDir, { recursive: true });

  const srcDir = path.join(projectRoot, NATIVE_SRC);
  if (!fs.existsSync(srcDir)) {
    console.warn("[withLearnGateNative] native-android sources missing at", srcDir);
    return;
  }

  const copied = [];
  for (const name of fs.readdirSync(srcDir)) {
    if (!name.endsWith(".kt")) continue;
    fs.copyFileSync(path.join(srcDir, name), path.join(destDir, name));
    copied.push(name);
  }
  if (copied.length < 8) {
    console.warn(
      `[withLearnGateNative] Expected 8+ Kotlin files in native-android, copied ${copied.length}: ${copied.join(", ")}`,
    );
  }
}

function ensureMainApplicationPackages(mainApplication) {
  let src = mainApplication.contents;

  const imports = [
    ["LearnGateBlockerPackage", "import com.pipsjacob.learngate.LearnGateBlockerPackage"],
    ["LearnGateChildLockPackage", "import com.pipsjacob.learngate.LearnGateChildLockPackage"],
    ["LearnGateUsageStatsPackage", "import com.pipsjacob.learngate.LearnGateUsageStatsPackage"],
  ];

  for (const [symbol, importLine] of imports) {
    if (!src.includes(symbol) && !src.includes(importLine)) {
      src = src.replace(
        "import expo.modules.ReactNativeHostWrapper",
        `import expo.modules.ReactNativeHostWrapper\n${importLine}`,
      );
    }
  }

  if (
    !src.includes("LearnGateBlockerPackage()") ||
    !src.includes("LearnGateChildLockPackage()") ||
    !src.includes("LearnGateUsageStatsPackage()")
  ) {
    if (src.includes("PackageList(this).packages.apply {")) {
      const additions = [];
      if (!src.includes("LearnGateBlockerPackage()")) {
        additions.push("              add(LearnGateBlockerPackage())");
      }
      if (!src.includes("LearnGateChildLockPackage()")) {
        additions.push("              add(LearnGateChildLockPackage())");
      }
      if (!src.includes("LearnGateUsageStatsPackage()")) {
        additions.push("              add(LearnGateUsageStatsPackage())");
      }
      if (additions.length > 0) {
        src = src.replace(
          /PackageList\(this\)\.packages\.apply\s*\{/,
          `PackageList(this).packages.apply {\n${additions.join("\n")}`,
        );
      }
    }
  }

  mainApplication.contents = src;
  return mainApplication;
}

function ensureAccessibilityService(manifest) {
  const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  const services = app.service ?? [];
  const list = Array.isArray(services) ? services : [services];
  const hasService = list.some(
    (s) => s?.$?.["android:name"] === ".LearnGateAccessibilityService",
  );

  if (!hasService) {
    const service = {
      $: {
        "android:name": ".LearnGateAccessibilityService",
        "android:exported": "false",
        "android:permission": "android.permission.BIND_ACCESSIBILITY_SERVICE",
      },
      "intent-filter": [
        {
          action: [{ $: { "android:name": "android.accessibilityservice.AccessibilityService" } }],
        },
      ],
      "meta-data": [
        {
          $: {
            "android:name": "android.accessibilityservice",
            "android:resource": "@xml/learn_gate_accessibility_service_config",
          },
        },
      ],
    };
    app.service = [...list, service];
  }

  return manifest;
}

function withLearnGateNative(config) {
  config = withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults;
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest);
    activity.$["android:lockTaskMode"] = "always";

    const usesPermissions = manifest.manifest["uses-permission"] ?? [];
    const permList = Array.isArray(usesPermissions) ? usesPermissions : [usesPermissions];
    const hasUsagePerm = permList.some(
      (p) => p?.$?.["android:name"] === "android.permission.PACKAGE_USAGE_STATS",
    );
    if (!hasUsagePerm) {
      manifest.manifest["uses-permission"] = [
        ...permList,
        {
          $: {
            "android:name": "android.permission.PACKAGE_USAGE_STATS",
            "tools:ignore": "ProtectedPermissions",
          },
        },
      ];
    }

    mod.modResults = ensureAccessibilityService(manifest);
    return mod;
  });

  config = withMainApplication(config, (mod) => {
    mod.modResults = ensureMainApplicationPackages(mod.modResults);
    return mod;
  });

  config = withDangerousMod(config, [
    "android",
    async (mod) => {
      copyNativeSources(mod.modRequest.projectRoot, mod.modRequest.platformProjectRoot);

      const xmlDir = path.join(
        mod.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "res",
        "xml",
      );
      fs.mkdirSync(xmlDir, { recursive: true });
      const xmlSrc = path.join(
        mod.modRequest.projectRoot,
        "native-android",
        "res",
        "xml",
        "learn_gate_accessibility_service_config.xml",
      );
      if (fs.existsSync(xmlSrc)) {
        fs.copyFileSync(
          xmlSrc,
          path.join(xmlDir, "learn_gate_accessibility_service_config.xml"),
        );
      }

      const stringsPath = path.join(
        mod.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "res",
        "values",
        "strings.xml",
      );
      if (fs.existsSync(stringsPath)) {
        let strings = fs.readFileSync(stringsPath, "utf8");
        const desc =
          "Keeps LearnGate in control: blocked apps and screen-time/bedtime lock. Turn on only if your parent set this up.";
        if (strings.includes("accessibility_service_description")) {
          strings = strings.replace(
            /<string name="accessibility_service_description">[^<]*<\/string>/,
            `<string name="accessibility_service_description">${desc}</string>`,
          );
        } else {
          strings = strings.replace(
            "</resources>",
            `  <string name="accessibility_service_description">${desc}</string>\n</resources>`,
          );
        }
        fs.writeFileSync(stringsPath, strings);
      }

      return mod;
    },
  ]);

  return config;
}

module.exports = withLearnGateNative;
