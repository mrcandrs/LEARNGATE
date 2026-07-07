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

  /**
   * Upsert a batch of allows WITHOUT dropping live allows that aren't in the batch.
   *
   * Multiple JS callers push the allow list (profile sync, realtime, launch, resume). Some of them
   * can fire with a stale/empty view of the active unlocks. A plain replace would then wipe a
   * currently-unlocked app's allow for a moment and bounce the child out. Merging keeps every
   * still-valid allow and only overwrites packages explicitly present in the incoming batch. Expired
   * entries are dropped here and again at read time, so time-based expiry still works normally.
   */
  fun mergeAllows(context: Context, entries: List<TempAllowEntry>) {
    val now = System.currentTimeMillis()
    val incoming = entries.filter { it.packageName.isNotBlank() && it.untilMs > now }
    val incomingPkgs = incoming.map { it.packageName }.toHashSet()

    val existing = readEntriesArray(context)
    val kept = JSONArray()
    for (i in 0 until existing.length()) {
      val obj = existing.optJSONObject(i) ?: continue
      val pkg = obj.optString("pkg", "")
      if (pkg.isBlank()) continue
      if (obj.optLong("until", 0L) <= now) continue
      if (incomingPkgs.contains(pkg)) continue
      kept.put(obj)
    }
    for (entry in incoming) {
      kept.put(entryToJson(entry))
    }

    context.applicationContext
      .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_ENTRIES, kept.toString())
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
