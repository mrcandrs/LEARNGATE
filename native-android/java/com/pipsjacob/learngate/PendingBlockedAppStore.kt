package com.pipsjacob.learngate

import android.content.Context

/**
 * When the Accessibility Service redirects back into LearnGate, JS can read which package triggered it once.
 */
object PendingBlockedAppStore {
  private const val PREFS_NAME = "learn_gate_pending_block"
  private const val KEY_PACKAGE = "blocked_package"

  fun mark(context: Context, pkg: String) {
    context.applicationContext
      .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_PACKAGE, pkg)
      .apply()
  }

  fun consume(context: Context): String? {
    val app = context.applicationContext
    val prefs = app.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val pkg = prefs.getString(KEY_PACKAGE, null) ?: return null
    prefs.edit().remove(KEY_PACKAGE).apply()
    return pkg
  }

  fun clear(context: Context) {
    context.applicationContext
      .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .clear()
      .apply()
  }
}
