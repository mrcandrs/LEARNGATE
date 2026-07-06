package com.pipsjacob.learngate

import android.content.Context

/** Persists child screen-time / bedtime lock so the Accessibility Service can enforce it without JS. */
object ChildScreenLockPolicyStore {
  private const val PREFS_NAME = "learn_gate_child_screen_lock"
  private const val KEY_LOCKED = "screen_locked"

  fun setLocked(context: Context, locked: Boolean) {
    context.applicationContext
      .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putBoolean(KEY_LOCKED, locked)
      .commit()
  }

  fun isLocked(context: Context): Boolean {
    return context.applicationContext
      .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .getBoolean(KEY_LOCKED, false)
  }
}
