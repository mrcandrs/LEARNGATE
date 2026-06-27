import AsyncStorage from "@react-native-async-storage/async-storage";
import { labelForPackage } from "@/constants/blockedAppPackages";
import {
  getLaunchablePackagesOnDevice,
  getUsageAccessGranted,
  isUsageStatsAvailable,
  isBackgroundUsageEvent,
  isForegroundUsageEvent,
  queryUsageEventsSince,
  resolveAppLabelOnDevice,
} from "@/services/appUsageStats";
import { supabase } from "@/services/supabase";
import { isReportableUserApp } from "@/utils/appUsagePackages";

const SYNC_KEY_PREFIX = "@learngate/usage_sync_ms/";
const INITIAL_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const OVERLAP_MS = 10 * 60 * 1000;
const DEDUPE_GAP_MS = 30 * 1000;

const IGNORED_PACKAGES = new Set(["com.pipsjacob.learngate"]);

export type ChildAppUsageRow = {
  child_id: string;
  package_name: string;
  app_label: string;
  event_type: "foreground" | "background";
  event_at: string;
  duration_seconds: number | null;
};

function syncKey(childId: string): string {
  return `${SYNC_KEY_PREFIX}${childId}`;
}

async function getLastSyncMs(childId: string): Promise<number | null> {
  const raw = await AsyncStorage.getItem(syncKey(childId));
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

async function setLastSyncMs(childId: string, ms: number): Promise<void> {
  await AsyncStorage.setItem(syncKey(childId), String(ms));
}

/** Clears sync cursor so the next sync re-scans the last 24 hours (child settings / debugging). */
export async function resetChildAppUsageSyncCursor(childId: string): Promise<void> {
  await AsyncStorage.removeItem(syncKey(childId));
}

function shouldIgnorePackage(packageName: string, launchable: Set<string> | null): boolean {
  if (IGNORED_PACKAGES.has(packageName)) return true;
  if (!isReportableUserApp(packageName)) return true;
  // When we know the device's launchable apps, only keep real user-facing apps.
  if (launchable && !launchable.has(packageName)) return true;
  return false;
}

/** Turns Usage Stats events into rows for Supabase (foreground opens + optional duration). */
export function buildUsageRowsForUpload(
  childId: string,
  events: { packageName: string; timestampMs: number; eventType: number }[],
  launchable: Set<string> | null = null
): ChildAppUsageRow[] {
  const sorted = [...events].sort((a, b) => a.timestampMs - b.timestampMs);
  const rows: ChildAppUsageRow[] = [];
  let openPkg: string | null = null;
  let openAt = 0;

  for (const e of sorted) {
    if (shouldIgnorePackage(e.packageName, launchable)) continue;

    if (isForegroundUsageEvent(e.eventType)) {
      const last = rows[rows.length - 1];
      if (
        last &&
        last.package_name === e.packageName &&
        e.timestampMs - new Date(last.event_at).getTime() < DEDUPE_GAP_MS
      ) {
        continue;
      }
      openPkg = e.packageName;
      openAt = e.timestampMs;
      rows.push({
        child_id: childId,
        package_name: e.packageName,
        app_label: labelForPackage(e.packageName),
        event_type: "foreground",
        event_at: new Date(e.timestampMs).toISOString(),
        duration_seconds: null,
      });
    } else if (isBackgroundUsageEvent(e.eventType) && openPkg === e.packageName) {
      const last = rows[rows.length - 1];
      if (last && last.package_name === e.packageName && last.duration_seconds == null) {
        const seconds = Math.max(1, Math.round((e.timestampMs - openAt) / 1000));
        last.duration_seconds = seconds;
      }
      openPkg = null;
      openAt = 0;
    }
  }

  return rows;
}

async function enrichRowsWithDeviceLabels(rows: ChildAppUsageRow[]): Promise<ChildAppUsageRow[]> {
  return Promise.all(
    rows.map(async (row) => {
      const deviceLabel = await resolveAppLabelOnDevice(row.package_name);
      const usableDeviceLabel =
        deviceLabel &&
        deviceLabel.trim() !== row.package_name &&
        !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i.test(deviceLabel.trim());
      return {
        ...row,
        app_label: usableDeviceLabel ? deviceLabel!.trim() : labelForPackage(row.package_name),
      };
    })
  );
}

/**
 * Pulls Android usage events since last sync and uploads to child_app_usage_events.
 * Requires Usage access on the child device (Settings → Special app access).
 */
export async function syncChildAppUsageEvents(childId: string): Promise<void> {
  if (!isUsageStatsAvailable() || !supabase) return;

  const granted = await getUsageAccessGranted();
  if (!granted) return;

  const lastMs = await getLastSyncMs(childId);
  const sinceMs = (lastMs ?? Date.now() - INITIAL_LOOKBACK_MS) - OVERLAP_MS;
  const events = await queryUsageEventsSince(sinceMs);

  let cursor = lastMs ?? sinceMs;
  for (const e of events) {
    if (e.timestampMs > cursor) cursor = e.timestampMs;
  }

  const launchable = await getLaunchablePackagesOnDevice();
  const built = buildUsageRowsForUpload(childId, events, launchable);
  const rows = await enrichRowsWithDeviceLabels(built);

  if (rows.length > 0) {
    const { error } = await supabase.from("child_app_usage_events").upsert(rows, {
      onConflict: "child_id,package_name,event_at,event_type",
      ignoreDuplicates: true,
    });
    if (error) {
      console.warn("[LearnGate] app usage sync failed:", error.message);
      return;
    }
  }

  // Only advance cursor when we actually received events (avoids skipping a window on empty OEM responses).
  if (events.length > 0) {
    await setLastSyncMs(childId, cursor);
  }
}
