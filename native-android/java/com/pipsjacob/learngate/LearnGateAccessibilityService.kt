package com.pipsjacob.learngate

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent

/**
 * When another app becomes foreground and its package is on the block list, return to LearnGate.
 * While child screen lock is active, any non-LearnGate foreground app (launcher, home, games) is bounced back.
 * The user must enable this service in Android Settings → Accessibility.
 */
class LearnGateAccessibilityService : AccessibilityService() {

  private var lastKickPkg: String? = null
  private var lastKickAtElapsed: Long = 0L

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event == null) return

    when (event.eventType) {
      AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED,
      AccessibilityEvent.TYPE_WINDOWS_CHANGED -> Unit
      else -> return
    }

    val pkg = resolveForegroundPackage(event) ?: return

    val self = packageName
    if (pkg == self) return

    if (ChildScreenLockPolicyStore.isLocked(applicationContext)) {
      redirectToLearnGate(pkg, markBlockedApp = false)
      return
    }

    if (pkg == "com.android.settings") return

    val blocked = AppBlockPolicyStore.getBlockedPackages(applicationContext)
    if (!blocked.contains(pkg)) return

    redirectToLearnGate(pkg, markBlockedApp = true)
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
}
