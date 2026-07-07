package com.pipsjacob.learngate

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
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

  private val expiryHandler = Handler(Looper.getMainLooper())
  private var expiryRunnable: Runnable? = null

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
      clearActiveUnlock()
      return
    }

    if (pkg == "com.android.settings") {
      clearActiveUnlock()
      return
    }

    if (isIgnorableForegroundPackage(pkg)) {
      return
    }

    if (hasActiveUnlock(pkg)) {
      Log.d(TAG, "allow $pkg (active unlock) — no bounce")
      showUnlockOverlay(pkg)
      return
    }

    if (activeUnlockPkg != null && pkg != activeUnlockPkg) {
      clearActiveUnlock()
    }

    if (ChildScreenLockPolicyStore.isLocked(applicationContext)) {
      Log.d(TAG, "BOUNCE $pkg — screen lock active (no active unlock)")
      UnlockTimerOverlay.hide(this)
      redirectToLearnGate(pkg, markBlockedApp = false)
      return
    }

    val blocked = AppBlockPolicyStore.getBlockedPackages(applicationContext)
    if (!blocked.contains(pkg)) {
      Log.d(TAG, "allow $pkg — not in block list")
      return
    }

    Log.d(TAG, "BOUNCE $pkg — in block list, no active unlock. blocked=$blocked")
    clearActiveUnlock()
    redirectToLearnGate(pkg, markBlockedApp = true)
  }

  private fun hasActiveUnlock(pkg: String): Boolean {
    val now = System.currentTimeMillis()
    val until = TempAllowPolicyStore.getUntilMs(applicationContext, pkg)
    if (until != null && until > now) return true
    // Backup: the launch/sync path also commits the unlock to the overlay "armed" prefs. If the
    // allow list read ever comes back empty for a beat, this prevents a false bounce.
    return UnlockTimerOverlay.armedUntilFor(applicationContext, pkg) > now
  }

  private fun showUnlockOverlay(pkg: String) {
    activeUnlockPkg = pkg
    UnlockTimerOverlay.showForPackage(this, pkg)
    scheduleExpiryEnforcement(pkg)
  }

  private fun clearActiveUnlock() {
    activeUnlockPkg = null
    UnlockTimerOverlay.hide(this)
    // Intentionally do NOT cancel the expiry timer: even if the child navigates away first, we
    // still want to re-block the app the instant its pass ends so it can't be reopened for free
    // during the brief window before the next JS re-sync.
  }

  /**
   * The accessibility service only reacts to foreground changes, so a temp unlock that expires
   * while the child is still inside the app would go unnoticed. Schedule a check for the exact
   * moment the pass ends to re-block and pull the child back to LearnGate.
   */
  private fun scheduleExpiryEnforcement(pkg: String) {
    cancelExpiryEnforcement()
    val until = TempAllowPolicyStore.getUntilMs(applicationContext, pkg) ?: return
    val delay = (until - System.currentTimeMillis()).coerceAtLeast(0L) + 750L
    val runnable = Runnable { enforceExpiry(pkg) }
    expiryRunnable = runnable
    expiryHandler.postDelayed(runnable, delay)
  }

  private fun cancelExpiryEnforcement() {
    expiryRunnable?.let { expiryHandler.removeCallbacks(it) }
    expiryRunnable = null
  }

  private fun enforceExpiry(pkg: String) {
    // Pass was extended (e.g. re-approved) — keep watching the new end time.
    if (hasActiveUnlock(pkg)) {
      scheduleExpiryEnforcement(pkg)
      return
    }

    expiryRunnable = null
    UnlockTimerOverlay.disarm(applicationContext)

    // The enforcement list excludes actively-unlocked apps, so this package was removed while the
    // pass was live. A temp unlock only ever exists for a parent-blocked app, so re-add it now to
    // guarantee it is blocked again immediately — even before the next JS sync.
    AppBlockPolicyStore.addBlockedPackage(applicationContext, pkg)

    // Only bounce the child out if they're still sitting inside the app that just expired.
    if (activeUnlockPkg == pkg) {
      activeUnlockPkg = null
      UnlockTimerOverlay.hide(this)
      redirectToLearnGate(pkg, markBlockedApp = true)
    }
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
    cancelExpiryEnforcement()
    UnlockTimerOverlay.hide(this)
    super.onDestroy()
  }

  companion object {
    private const val TAG = "LearnGateBlocker"
    private var instance: WeakReference<LearnGateAccessibilityService>? = null

    fun notifyUnlockedAppLaunched(context: android.content.Context, packageName: String, label: String?, untilMs: Long) {
      if (packageName.isBlank() || untilMs <= System.currentTimeMillis()) return
      val safeLabel = label?.trim().takeUnless { it.isNullOrEmpty() } ?: "App"
      UnlockTimerOverlay.arm(context, packageName, safeLabel, untilMs)
      instance?.get()?.showUnlockOverlay(packageName)
    }
  }
}
