package com.pipsjacob.learngate

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.TextView

/**
 * Floating timer over other apps while a star-unlock is active.
 * Uses TYPE_ACCESSIBILITY_OVERLAY from the bound accessibility service.
 */
object UnlockTimerOverlay {
  private const val TAG = "LearnGateOverlay"
  private const val PREFS = "learn_gate_unlock_overlay"
  private const val KEY_PKG = "armed_pkg"
  private const val KEY_UNTIL = "armed_until"
  private const val KEY_LABEL = "armed_label"

  private val mainHandler = Handler(Looper.getMainLooper())
  private var windowManager: WindowManager? = null
  private var overlayRoot: FrameLayout? = null
  private var labelView: TextView? = null
  private var shownPkg: String? = null
  private var appLabel: String = "App"
  private var untilMs: Long = 0L

  private val tickRunnable = object : Runnable {
    override fun run() {
      refreshLabel()
      if (overlayRoot != null) {
        mainHandler.postDelayed(this, 1000L)
      }
    }
  }

  /** Remember an unlock so the accessibility service can show the pill on next foreground event. */
  fun arm(context: Context, packageName: String, label: String, untilMs: Long) {
    if (packageName.isBlank() || untilMs <= System.currentTimeMillis()) return
    context.applicationContext
      .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_PKG, packageName)
      .putLong(KEY_UNTIL, untilMs)
      .putString(KEY_LABEL, label)
      .commit()
  }

  fun disarm(context: Context) {
    context.applicationContext
      .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .remove(KEY_PKG)
      .remove(KEY_UNTIL)
      .remove(KEY_LABEL)
      .commit()
  }

  fun showForPackage(service: AccessibilityService, packageName: String) {
    val ctx = service.applicationContext
    val until = TempAllowPolicyStore.getUntilMs(ctx, packageName)
    if (until != null && until > System.currentTimeMillis()) {
      val label = TempAllowPolicyStore.getLabel(ctx, packageName) ?: readArmedLabel(ctx, packageName) ?: "App"
      show(service, packageName, label, until)
      return
    }

    val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val armedPkg = prefs.getString(KEY_PKG, null)
    if (armedPkg != packageName) return
    val armedUntil = prefs.getLong(KEY_UNTIL, 0L)
    if (armedUntil <= System.currentTimeMillis()) {
      disarm(ctx)
      return
    }
    val label = prefs.getString(KEY_LABEL, null) ?: "App"
    show(service, packageName, label, armedUntil)
  }

  fun show(service: AccessibilityService, packageName: String, label: String, until: Long) {
    mainHandler.post {
      appLabel = label
      untilMs = until
      shownPkg = packageName

      if (overlayRoot != null) {
        refreshLabel()
        return@post
      }

      val density = service.resources.displayMetrics.density
      val padH = (16 * density).toInt()
      val padV = (11 * density).toInt()
      val radius = 22 * density

      val root = FrameLayout(service)
      val bg = GradientDrawable().apply {
        setColor(0xF0182538.toInt())
        cornerRadius = radius
        setStroke((1.5f * density).toInt().coerceAtLeast(1), 0xFF4ADE80.toInt())
      }
      root.background = bg
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
        root.elevation = 16 * density
        root.translationZ = 16 * density
      }

      val text = TextView(service)
      text.setTextColor(0xFFFFFFFF.toInt())
      text.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
      text.setTypeface(null, Typeface.BOLD)
      labelView = text
      root.addView(text)
      root.setPadding(padH, padV, padH, padV)

      val params = WindowManager.LayoutParams(
        WindowManager.LayoutParams.WRAP_CONTENT,
        WindowManager.LayoutParams.WRAP_CONTENT,
        WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
          WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
          WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
          WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
        PixelFormat.TRANSLUCENT
      )
      params.gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
      params.y = (72 * density).toInt()
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        params.layoutInDisplayCutoutMode =
          WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
      }

      windowManager = service.getSystemService(WindowManager::class.java)
      overlayRoot = root
      try {
        windowManager?.addView(root, params)
        refreshLabel()
        mainHandler.removeCallbacks(tickRunnable)
        mainHandler.post(tickRunnable)
        Log.d(TAG, "overlay shown for $packageName")
      } catch (e: Exception) {
        Log.e(TAG, "overlay addView failed for $packageName", e)
        overlayRoot = null
        labelView = null
        shownPkg = null
      }
    }
  }

  fun hide(service: AccessibilityService) {
    mainHandler.post {
      mainHandler.removeCallbacks(tickRunnable)
      val wm = windowManager ?: service.getSystemService(WindowManager::class.java)
      val root = overlayRoot
      overlayRoot = null
      labelView = null
      shownPkg = null
      untilMs = 0L
      if (root != null) {
        try {
          wm.removeView(root)
        } catch (e: Exception) {
          Log.w(TAG, "overlay removeView failed", e)
        }
      }
    }
  }

  fun isShowingFor(packageName: String): Boolean {
    return overlayRoot != null && shownPkg == packageName
  }

  private fun readArmedLabel(context: Context, packageName: String): String? {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    return if (prefs.getString(KEY_PKG, null) == packageName) {
      prefs.getString(KEY_LABEL, null)
    } else {
      null
    }
  }

  private fun refreshLabel() {
    val remaining = untilMs - System.currentTimeMillis()
    if (remaining <= 0L) {
      labelView?.text = "$appLabel · ended"
      return
    }
    val totalSec = ((remaining + 999L) / 1000L).toInt()
    val h = totalSec / 3600
    val m = (totalSec % 3600) / 60
    val s = totalSec % 60
    val timeLabel = when {
      h > 0 -> "${h}h ${m}m left"
      m > 0 -> "${m}m ${s}s left"
      else -> "${s}s left"
    }
    labelView?.text = "$appLabel · $timeLabel"
  }
}
