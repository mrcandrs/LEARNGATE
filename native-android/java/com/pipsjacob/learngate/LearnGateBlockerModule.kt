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
      PendingBlockedAppStore.clear(reactApplicationContext)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("BLOCKER_CLEAR", e.message, e)
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
