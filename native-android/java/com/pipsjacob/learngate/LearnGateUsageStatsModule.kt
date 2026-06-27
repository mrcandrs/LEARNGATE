package com.pipsjacob.learngate

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStats
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Process
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap

/**
 * Reads Android Usage Stats (requires Settings → Special app access → Usage access).
 * Merges UsageEvents + UsageStats aggregates so apps like YouTube/Instagram are not missed on OEM devices.
 */
class LearnGateUsageStatsModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "LearnGateUsageStats"

  @ReactMethod
  fun isUsageAccessGranted(promise: Promise) {
    try {
      promise.resolve(hasUsageStatsPermission(reactApplicationContext))
    } catch (e: Exception) {
      promise.reject("USAGE_STATUS", e.message, e)
    }
  }

  @ReactMethod
  fun resolveAppLabel(packageName: String, promise: Promise) {
    try {
      val pm = reactApplicationContext.packageManager
      val info =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          pm.getApplicationInfo(packageName, PackageManager.ApplicationInfoFlags.of(0))
        } else {
          @Suppress("DEPRECATION")
          pm.getApplicationInfo(packageName, 0)
        }
      promise.resolve(pm.getApplicationLabel(info).toString())
    } catch (_: PackageManager.NameNotFoundException) {
      promise.resolve(packageName)
    } catch (e: Exception) {
      promise.reject("USAGE_LABEL", e.message, e)
    }
  }

  @ReactMethod
  fun openUsageAccessSettings() {
    val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    reactApplicationContext.startActivity(intent)
  }

  /**
   * Package names that have a home-screen launcher icon — i.e. real, user-facing apps.
   * Lets the child sync skip system dialogs/services (captive portal, VPN, resolvers, etc.).
   */
  @ReactMethod
  fun getLaunchablePackages(promise: Promise) {
    try {
      val pm = reactApplicationContext.packageManager
      val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
      val resolveInfos =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          pm.queryIntentActivities(intent, PackageManager.ResolveInfoFlags.of(0L))
        } else {
          @Suppress("DEPRECATION")
          pm.queryIntentActivities(intent, 0)
        }

      val out = Arguments.createArray()
      val seen = HashSet<String>()
      for (info in resolveInfos) {
        val pkg = info.activityInfo?.packageName?.trim().orEmpty()
        if (pkg.isNotEmpty() && seen.add(pkg)) {
          out.pushString(pkg)
        }
      }
      promise.resolve(out)
    } catch (e: Exception) {
      promise.reject("USAGE_LAUNCHABLE", e.message, e)
    }
  }

  @ReactMethod
  fun queryUsageEvents(sinceMs: Double, promise: Promise) {
    try {
      val context = reactApplicationContext
      if (!hasUsageStatsPermission(context)) {
        promise.reject("USAGE_DENIED", "Usage access not granted for LearnGate")
        return
      }

      val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val since = sinceMs.toLong().coerceAtLeast(0L)
      val now = System.currentTimeMillis()
      if (since >= now) {
        promise.resolve(Arguments.createArray())
        return
      }

      val out = Arguments.createArray()
      val latestForegroundMs = HashMap<String, Long>()

      val usageEvents = usm.queryEvents(since, now)
      val event = UsageEvents.Event()
      while (usageEvents.hasNextEvent()) {
        usageEvents.getNextEvent(event)
        val pkg = event.packageName?.trim().orEmpty()
        if (pkg.isEmpty()) continue
        if (!isForegroundLike(event.eventType) && !isBackgroundLike(event.eventType)) continue

        pushEvent(out, pkg, event.timeStamp, event.eventType)
        if (isForegroundLike(event.eventType)) {
          latestForegroundMs[pkg] = event.timeStamp
        }
      }

      appendUsageStatsFallback(usm, since, now, out, latestForegroundMs)

      promise.resolve(out)
    } catch (e: Exception) {
      promise.reject("USAGE_QUERY", e.message, e)
    }
  }

  companion object {
    private const val MIN_FOREGROUND_MS = 1_500L

    fun hasUsageStatsPermission(context: Context): Boolean {
      val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
      val mode =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          appOps.unsafeCheckOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            Process.myUid(),
            context.packageName,
          )
        } else {
          @Suppress("DEPRECATION")
          appOps.checkOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            Process.myUid(),
            context.packageName,
          )
        }
      return mode == AppOpsManager.MODE_ALLOWED
    }

    private fun isForegroundLike(type: Int): Boolean {
      return type == UsageEvents.Event.MOVE_TO_FOREGROUND ||
        (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && type == UsageEvents.Event.ACTIVITY_RESUMED)
    }

    private fun isBackgroundLike(type: Int): Boolean {
      return type == UsageEvents.Event.MOVE_TO_BACKGROUND ||
        (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && type == UsageEvents.Event.ACTIVITY_PAUSED)
    }

    private fun pushEvent(out: WritableArray, pkg: String, timeMs: Long, eventType: Int) {
      val map: WritableMap = Arguments.createMap()
      map.putString("packageName", pkg)
      map.putDouble("timestampMs", timeMs.toDouble())
      map.putInt("eventType", eventType)
      out.pushMap(map)
    }

    /** Fills gaps when queryEvents omits apps (common on Samsung/Xiaomi). */
    private fun appendUsageStatsFallback(
      usm: UsageStatsManager,
      since: Long,
      now: Long,
      out: WritableArray,
      latestForegroundMs: HashMap<String, Long>,
    ) {
      val stats: List<UsageStats> =
        usm.queryUsageStats(UsageStatsManager.INTERVAL_BEST, since, now) ?: return

      for (stat in stats) {
        val pkg = stat.packageName?.trim().orEmpty()
        if (pkg.isEmpty()) continue
        if (stat.lastTimeUsed < since) continue
        if (stat.totalTimeInForeground < MIN_FOREGROUND_MS) continue

        val existing = latestForegroundMs[pkg]
        if (existing != null && kotlin.math.abs(stat.lastTimeUsed - existing) < 90_000L) {
          continue
        }

        pushEvent(out, pkg, stat.lastTimeUsed, UsageEvents.Event.MOVE_TO_FOREGROUND)
        latestForegroundMs[pkg] = stat.lastTimeUsed
      }
    }
  }
}
