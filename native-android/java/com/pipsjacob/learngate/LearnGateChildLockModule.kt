package com.pipsjacob.learngate

import android.app.Activity
import android.app.ActivityManager
import android.content.Context
import android.os.Build
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Kiosk helpers for child screen-time / bedtime lock:
 * - Lock Task Mode (blocks Home/Recents when the device allows it)
 * - Immersive system bars
 * - Flag for Accessibility Service to pull the user back from launcher/other apps
 */
class LearnGateChildLockModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "LearnGateChildLock"

  @ReactMethod
  fun setScreenLocked(locked: Boolean, promise: Promise) {
    try {
      ChildScreenLockPolicyStore.setLocked(reactApplicationContext, locked)
      promise.resolve(locked)
    } catch (e: Exception) {
      promise.reject("CHILD_LOCK_FLAG", e.message, e)
    }
  }

  /**
   * Hides system bars while locked. Does NOT call startLockTask() — on personal phones that
   * triggers the "App is pinned" system dialog every time. Enforcement uses Accessibility + nav hide.
   */
  @ReactMethod
  fun startKiosk(promise: Promise) {
    val activity: Activity? = reactApplicationContext.getCurrentActivity()
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "No foreground activity")
      return
    }
    activity.runOnUiThread {
      try {
        applyImmersive(activity)
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("KIOSK_START", e.message, e)
      }
    }
  }

  @ReactMethod
  fun stopKiosk(promise: Promise) {
    val activity: Activity? = reactApplicationContext.getCurrentActivity()
    if (activity == null) {
      promise.resolve(false)
      return
    }
    activity.runOnUiThread {
      try {
        clearImmersive(activity)
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("KIOSK_STOP", e.message, e)
      }
    }
  }

  /** Re-apply immersive mode without lock task (safe to call on a timer). */
  @ReactMethod
  fun reapplyImmersive(promise: Promise) {
    val activity: Activity? = reactApplicationContext.getCurrentActivity()
    if (activity == null) {
      promise.resolve(false)
      return
    }
    activity.runOnUiThread {
      try {
        applyImmersive(activity)
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("KIOSK_IMMERSIVE", e.message, e)
      }
    }
  }

  @ReactMethod
  fun isInLockTask(promise: Promise) {
    try {
      promise.resolve(isLockTaskActive(reactApplicationContext))
    } catch (e: Exception) {
      promise.reject("KIOSK_STATUS", e.message, e)
    }
  }

  private fun isLockTaskActive(context: Context): Boolean {
    val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      activityManager.lockTaskModeState != ActivityManager.LOCK_TASK_MODE_NONE
    } else {
      @Suppress("DEPRECATION")
      activityManager.isInLockTaskMode
    }
  }

  companion object {
    fun applyImmersive(activity: Activity) {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        activity.window.setDecorFitsSystemWindows(false)
        activity.window.insetsController?.let { controller ->
          controller.hide(WindowInsets.Type.systemBars())
          controller.systemBarsBehavior =
            WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
      } else {
        @Suppress("DEPRECATION")
        activity.window.decorView.systemUiVisibility = (
          View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_FULLSCREEN
            or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
          )
      }
      activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    fun clearImmersive(activity: Activity) {
      activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        activity.window.setDecorFitsSystemWindows(true)
        activity.window.insetsController?.show(WindowInsets.Type.systemBars())
      } else {
        @Suppress("DEPRECATION")
        activity.window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_VISIBLE
      }
    }
  }
}
