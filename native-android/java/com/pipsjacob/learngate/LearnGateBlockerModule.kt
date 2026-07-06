package com.pipsjacob.learngate

import android.content.ComponentName
import android.content.Intent
import android.provider.Settings
import android.text.TextUtils
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap

class LearnGateBlockerModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "LearnGateBlocker"

  @ReactMethod
  fun setBlockedPackages(packages: ReadableArray, promise: Promise) {
    try {
      val list = ArrayList<String>()
      for (i in 0 until packages.size()) {
        if (!packages.isNull(i)) {
          val s = packages.getString(i)
          if (s != null && s.isNotBlank()) {
            list.add(s)
          }
        }
      }
      AppBlockPolicyStore.setBlockedPackages(reactApplicationContext, list)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("BLOCKER_SET", e.message, e)
    }
  }

  @ReactMethod
  fun clearBlockedPackages(promise: Promise) {
    try {
      AppBlockPolicyStore.clear(reactApplicationContext)
      TempAllowPolicyStore.clear(reactApplicationContext)
      PendingBlockedAppStore.clear(reactApplicationContext)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("BLOCKER_CLEAR", e.message, e)
    }
  }

  @ReactMethod
  fun mergeTemporaryAllow(
    packageName: String,
    untilMs: Double,
    appLabel: String?,
    promise: Promise
  ) {
    try {
      if (packageName.isBlank()) {
        promise.resolve(false)
        return
      }
      TempAllowPolicyStore.mergeAllow(
        reactApplicationContext,
        packageName,
        untilMs.toLong(),
        appLabel
      )
      LearnGateAccessibilityService.notifyUnlockedAppLaunched(
        reactApplicationContext,
        packageName,
        appLabel,
        untilMs.toLong()
      )
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("BLOCKER_TEMP_MERGE", e.message, e)
    }
  }

  @ReactMethod
  fun setTemporaryAllows(entries: ReadableArray, promise: Promise) {
    try {
      val list = ArrayList<TempAllowPolicyStore.TempAllowEntry>()
      for (i in 0 until entries.size()) {
        if (entries.isNull(i)) continue
        val map: ReadableMap = entries.getMap(i) ?: continue
        val pkg = if (map.hasKey("package_name")) map.getString("package_name") else null
        val label = if (map.hasKey("app_label")) map.getString("app_label") else null
        val untilMs =
          when {
            map.hasKey("unlock_until_ms") -> {
              val raw = map.getDouble("unlock_until_ms")
              if (raw.isNaN() || raw <= 0.0) 0L else raw.toLong()
            }
            else -> 0L
          }
        if (pkg != null && pkg.isNotBlank() && untilMs > 0L) {
          list.add(TempAllowPolicyStore.TempAllowEntry(pkg, untilMs, label))
        }
      }
      TempAllowPolicyStore.setAllows(reactApplicationContext, list)
      for (entry in list) {
        UnlockTimerOverlay.arm(
          reactApplicationContext,
          entry.packageName,
          entry.label ?: "App",
          entry.untilMs
        )
      }
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("BLOCKER_TEMP_ALLOW", e.message, e)
    }
  }

  @ReactMethod
  fun isPackageTempAllowed(packageName: String, promise: Promise) {
    try {
      promise.resolve(TempAllowPolicyStore.isAllowed(reactApplicationContext, packageName))
    } catch (e: Exception) {
      promise.reject("BLOCKER_TEMP_CHECK", e.message, e)
    }
  }

  @ReactMethod
  fun launchAppPackage(packageName: String, promise: Promise) {
    try {
      if (packageName.isBlank()) {
        promise.resolve(false)
        return
      }
      val pm = reactApplicationContext.packageManager
      val intent = pm.getLaunchIntentForPackage(packageName)
      if (intent == null) {
        promise.resolve(false)
        return
      }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactApplicationContext.startActivity(intent)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("BLOCKER_LAUNCH", e.message, e)
    }
  }

  @ReactMethod
  fun launchUnlockedApp(
    packageName: String,
    untilMs: Double,
    appLabel: String?,
    promise: Promise
  ) {
    try {
      if (packageName.isBlank()) {
        promise.resolve(false)
        return
      }
      if (!untilMs.isNaN() && untilMs > System.currentTimeMillis().toDouble()) {
        val until = untilMs.toLong()
        TempAllowPolicyStore.mergeAllow(
          reactApplicationContext,
          packageName,
          until,
          appLabel
        )
        LearnGateAccessibilityService.notifyUnlockedAppLaunched(
          reactApplicationContext,
          packageName,
          appLabel,
          until
        )
      }
      val pm = reactApplicationContext.packageManager
      val intent = pm.getLaunchIntentForPackage(packageName)
      if (intent == null) {
        promise.resolve(false)
        return
      }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactApplicationContext.startActivity(intent)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("BLOCKER_LAUNCH", e.message, e)
    }
  }

  @ReactMethod
  fun consumePendingBlockedPackage(promise: Promise) {
    try {
      promise.resolve(PendingBlockedAppStore.consume(reactApplicationContext))
    } catch (e: Exception) {
      promise.reject("BLOCKER_PENDING", e.message, e)
    }
  }

  @ReactMethod
  fun isAccessibilityEnabled(promise: Promise) {
    try {
      promise.resolve(isLearnGateAccessibilityEnabled(reactApplicationContext))
    } catch (e: Exception) {
      promise.reject("BLOCKER_STATUS", e.message, e)
    }
  }

  @ReactMethod
  fun openAccessibilitySettings() {
    val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    reactApplicationContext.startActivity(intent)
  }

  companion object {
    private fun isLearnGateAccessibilityEnabled(context: android.content.Context): Boolean {
      val enabledServices = Settings.Secure.getString(
        context.contentResolver,
        Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
      ) ?: return false

      val myComponent = ComponentName(context, LearnGateAccessibilityService::class.java)
      val splitter = TextUtils.SimpleStringSplitter(':')
      splitter.setString(enabledServices)
      while (splitter.hasNext()) {
        val component = ComponentName.unflattenFromString(splitter.next())
        if (component != null && component == myComponent) {
          return true
        }
      }
      return false
    }
  }
}
