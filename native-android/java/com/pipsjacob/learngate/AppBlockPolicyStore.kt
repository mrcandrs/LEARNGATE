package com.pipsjacob.learngate

import android.content.Context

/**
 * Persists the blocked package list so the Accessibility Service can read it without running JS.
 */
object AppBlockPolicyStore {
  private const val PREFS_NAME = "learn_gate_app_block"
  private const val KEY_PACKAGES = "blocked_packages"

  fun setBlockedPackages(context: Context, packages: Collection<String>) {
    val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val copy = HashSet(packages.filter { it.isNotBlank() })
    prefs.edit().putStringSet(KEY_PACKAGES, copy).apply()
  }

  fun getBlockedPackages(context: Context): Set<String> {
    val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val raw = prefs.getStringSet(KEY_PACKAGES, emptySet()) ?: return emptySet()
    return HashSet(raw)
  }

  fun clear(context: Context) {
    val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    prefs.edit().remove(KEY_PACKAGES).apply()
  }
}
