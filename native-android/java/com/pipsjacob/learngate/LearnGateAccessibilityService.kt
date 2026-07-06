package com.pipsjacob.learngate

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent
import java.lang.ref.WeakReference

/**
 * When another app becomes foreground and its package is on the block list, return to LearnGate.
 * While child screen lock is active, any non-LearnGate foreground app (launcher, home, games) is bounced back.
 * The user must enable this service in Android Settings → Accessibility.
 */
class LearnGateAccessibilityService : AccessibilityService() {

  private var lastKickPkg: String? = null
  private var lastKickAtElapsed: Long = 0L
  private var activeUnlockPkg: String? = null

  override fun onServiceConnected() {
    super.onServiceConnected()
    instance = WeakReference(this)
    val armedPkg =
      applicationContext
        .getSharedPreferences("learn_gate_unlock_overlay", MODE_PRIVATE)
        .getString("armed_pkg", null)
    if (!armedPkg.isNullOrBlank()) {
      showUnlockOverlay(armedPkg)
    }
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event == null) return

    when (event.eventType) {
      AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED,
      AccessibilityEvent.TYPE_WINDOWS_CHANGED -> Unit
      else -> return
    }

    val pkg = resolveForegroundPackage(event) ?: return

    val self = packageName
    if (pkg == self) {
      activeUnlockPkg = null
      UnlockTimerOverlay.hide(this)
      return
    }

    if (pkg == "com.android.settings") {
      activeUnlockPkg = null
      UnlockTimerOverlay.hide(this)
      return
    }

    if (isIgnorableForegroundPackage(pkg)) {
      return
    }

    if (hasActiveUnlock(pkg)) {
      showUnlockOverlay(pkg)
      return
    }

    if (activeUnlockPkg != null && pkg != activeUnlockPkg) {
      activeUnlockPkg = null
      UnlockTimerOverlay.hide(this)
      UnlockTimerOverlay.disarm(applicationContext)
    }

    if (ChildScreenLockPolicyStore.isLocked(applicationContext)) {
      UnlockTimerOverlay.hide(this)
      redirectToLearnGate(pkg, markBlockedApp = false)
      return
    }

    val blocked = AppBlockPolicyStore.getBlockedPackages(applicationContext)
    if (!blocked.contains(pkg)) return

    activeUnlockPkg = null
    UnlockTimerOverlay.hide(this)
    redirectToLearnGate(pkg, markBlockedApp = true)
  }

  private fun hasActiveUnlock(pkg: String): Boolean {
    val until = TempAllowPolicyStore.getUntilMs(applicationContext, pkg) ?: return false
    return until > System.currentTimeMillis()
  }

  private fun showUnlockOverlay(pkg: String) {
    activeUnlockPkg = pkg
    UnlockTimerOverlay.showForPackage(this, pkg)
  }

  private fun isIgnorableForegroundPackage(pkg: String): Boolean {
    if (pkg == "com.android.systemui") return true
    if (pkg == "android") return true
    if (pkg.contains("launcher", ignoreCase = true)) return true
    if (pkg.contains("inputmethod", ignoreCase = true)) return true
    if (pkg == "com.google.android.inputmethod.latin") return true
    if (pkg == "com.samsung.android.app.cocktailbarservice") return true
    return false
  }

  private fun redirectToLearnGate(pkg: String, markBlockedApp: Boolean) {
    val now = SystemClock.elapsedRealtime()
    if (pkg == lastKickPkg && now - lastKickAtElapsed < 600L) return
    lastKickPkg = pkg
    lastKickAtElapsed = now

    if (markBlockedApp) {
      PendingBlockedAppStore.mark(applicationContext, pkg)
    }

    val intent = Intent(this, MainActivity::class.java).apply {
      addFlags(
        Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_CLEAR_TOP or
          Intent.FLAG_ACTIVITY_SINGLE_TOP
      )
    }
    startActivity(intent)
  }

  private fun resolveForegroundPackage(event: AccessibilityEvent): String? {
    val ordered = mutableListOf<String>()
    rootInActiveWindow?.packageName?.toString()?.trim()?.takeIf { it.isNotEmpty() }?.let { ordered.add(it) }
    event.packageName?.toString()?.trim()?.takeIf { it.isNotEmpty() }?.let {
      if (!ordered.contains(it)) ordered.add(it)
    }
    return ordered.firstOrNull()
  }

  override fun onInterrupt() {
    // No continuous callbacks to stop.
  }

  override fun onDestroy() {
    instance = null
    UnlockTimerOverlay.hide(this)
    super.onDestroy()
  }

  companion object {
    private var instance: WeakReference<LearnGateAccessibilityService>? = null

    fun notifyUnlockedAppLaunched(context: android.content.Context, packageName: String, label: String?, untilMs: Long) {
      if (packageName.isBlank() || untilMs <= System.currentTimeMillis()) return
      val safeLabel = label?.trim().takeUnless { it.isNullOrEmpty() } ?: "App"
      UnlockTimerOverlay.arm(context, packageName, safeLabel, untilMs)
      instance?.get()?.showUnlockOverlay(packageName)
    }
  }
}
