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
    prefs.edit().putStringSet(KEY_PACKAGES, copy).commit()
  }

  fun getBlockedPackages(context: Context): Set<String> {
    val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val raw = prefs.getStringSet(KEY_PACKAGES, emptySet()) ?: return emptySet()
    return HashSet(raw)
  }

  /** Re-add a package to the enforcement list immediately (e.g. when a temp unlock expires). */
  fun addBlockedPackage(context: Context, packageName: String) {
    if (packageName.isBlank()) return
    val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val current = HashSet(prefs.getStringSet(KEY_PACKAGES, emptySet()) ?: emptySet())
    if (current.add(packageName)) {
      prefs.edit().putStringSet(KEY_PACKAGES, current).commit()
    }
  }

  fun clear(context: Context) {
    val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    prefs.edit().remove(KEY_PACKAGES).commit()
  }
}
