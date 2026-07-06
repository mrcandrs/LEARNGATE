package com.pipsjacob.learngate

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Packages temporarily allowed despite being on the block list (parent-approved star unlock).
 * Values are expiry epoch millis (System.currentTimeMillis).
 * Uses commit() so the accessibility service never reads a stale empty list.
 */
object TempAllowPolicyStore {
  private const val PREFS_NAME = "learn_gate_temp_allow"
  private const val KEY_ENTRIES = "entries_json"

  data class TempAllowEntry(
    val packageName: String,
    val untilMs: Long,
    val label: String? = null,
  )

  fun setAllows(context: Context, entries: List<TempAllowEntry>) {
    val arr = JSONArray()
    val now = System.currentTimeMillis()
    for (entry in entries) {
      if (entry.packageName.isBlank() || entry.untilMs <= now) continue
      arr.put(entryToJson(entry))
    }
    context.applicationContext
      .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_ENTRIES, arr.toString())
      .commit()
  }

  fun mergeAllow(context: Context, packageName: String, untilMs: Long, label: String?) {
    if (packageName.isBlank() || untilMs <= System.currentTimeMillis()) return
    val arr = readEntriesArray(context)
    val kept = JSONArray()
    for (i in 0 until arr.length()) {
      val obj = arr.optJSONObject(i) ?: continue
      if (obj.optString("pkg", "") == packageName) continue
      kept.put(obj)
    }
    kept.put(
      entryToJson(TempAllowEntry(packageName, untilMs, label))
    )
    context.applicationContext
      .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_ENTRIES, kept.toString())
      .commit()
  }

  fun clear(context: Context) {
    context.applicationContext
      .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .remove(KEY_ENTRIES)
      .commit()
  }

  fun getUntilMs(context: Context, packageName: String): Long? {
    return entryForPackage(context, packageName)?.untilMs
  }

  fun getLabel(context: Context, packageName: String): String? {
    val label = entryForPackage(context, packageName)?.label?.trim()
    return if (label.isNullOrEmpty()) null else label
  }

  private data class StoredEntry(val untilMs: Long, val label: String?)

  private fun entryToJson(entry: TempAllowEntry): JSONObject {
    return JSONObject()
      .put("pkg", entry.packageName)
      .put("until", entry.untilMs)
      .put("label", entry.label ?: "")
  }

  private fun readEntriesArray(context: Context): JSONArray {
    val raw =
      context.applicationContext
        .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        .getString(KEY_ENTRIES, null)
        ?: return JSONArray()
    return try {
      JSONArray(raw)
    } catch (_: Exception) {
      JSONArray()
    }
  }

  private fun entryForPackage(context: Context, packageName: String): StoredEntry? {
    if (packageName.isBlank()) return null
    val now = System.currentTimeMillis()
    return try {
      val arr = readEntriesArray(context)
      for (i in 0 until arr.length()) {
        val obj = arr.optJSONObject(i) ?: continue
        if (obj.optString("pkg", "") != packageName) continue
        val until = obj.optLong("until", 0L)
        if (until <= now) return null
        val label = obj.optString("label", "").trim().ifEmpty { null }
        return StoredEntry(until, label)
      }
      null
    } catch (_: Exception) {
      null
    }
  }

  fun isAllowed(context: Context, packageName: String): Boolean {
    return getUntilMs(context, packageName) != null
  }
}
