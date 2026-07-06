import { Platform } from "react-native";
import { labelForPackage } from "@/constants/blockedAppPackages";
import type { TempUnlockRow, UnlockDuration } from "@/constants/appUnlock";
import { fetchChildTempUnlocks } from "@/services/appUnlock";
import { mergeUnlockRowToNative, syncNativeChildBlockPolicy } from "@/services/appBlocking";
import { fetchChildProfileForCurrentUser } from "@/services/childProfileFetch";
import { emitChildProfileRefresh } from "@/services/childProfileEvents";

const native = require("react-native").NativeModules.LearnGateBlocker as
  | { isPackageTempAllowed?: (packageName: string) => Promise<boolean> }
  | undefined;

/** Push latest block rules + temp-unlock rows to native immediately. */
export async function flushTempUnlocksToNative(): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }

  const { child, error } = await fetchChildProfileForCurrentUser();
  if (error || !child?.id) {
    return;
  }

  const rows = await fetchChildTempUnlocks(child.id);
  await syncNativeChildBlockPolicy(child.blocked_apps_json ?? [], rows, { allowEmptyAllows: true });
}

export async function onChildUnlockApprovedPush(data?: Record<string, unknown>): Promise<void> {
  if (Platform.OS === "android" && data) {
    const pkg = typeof data.package_name === "string" ? data.package_name : null;
    const unlockUntil = typeof data.unlock_until === "string" ? data.unlock_until : null;
    if (pkg && unlockUntil) {
      const duration =
        data.duration === "30m" || data.duration === "rest_of_day" || data.duration === "week"
          ? (data.duration as UnlockDuration)
          : null;
      const startedAt = typeof data.started_at === "string" ? data.started_at : null;
      await mergeUnlockRowToNative({
        package_name: pkg,
        unlock_until: unlockUntil,
        duration,
        started_at: startedAt,
      });
    }
  }

  await flushTempUnlocksToNative();
  emitChildProfileRefresh();
}

export async function onChildUnlockExpiredPush(): Promise<void> {
  await flushTempUnlocksToNative();
  emitChildProfileRefresh();
}

/** Write native policy for a package and verify it stuck (retries full flush once). */
export async function ensurePackageAllowedOnNative(
  packageName: string,
  row: TempUnlockRow,
  allRows?: TempUnlockRow[],
  blockedPackages?: string[]
): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }

  const rows = allRows ?? [row];
  if (blockedPackages) {
    await syncNativeChildBlockPolicy(blockedPackages, rows);
  } else {
    await mergeUnlockRowToNative(row, rows);
  }

  if (native?.isPackageTempAllowed && (await native.isPackageTempAllowed(packageName))) {
    return;
  }

  await flushTempUnlocksToNative();

  if (native?.isPackageTempAllowed && (await native.isPackageTempAllowed(packageName))) {
    return;
  }

  if (blockedPackages) {
    await syncNativeChildBlockPolicy(blockedPackages, rows);
  } else {
    await mergeUnlockRowToNative(row, rows);
  }
}

export function tempUnlockRowsToNativePayload(rows: TempUnlockRow[]) {
  return rows.map((row) => ({
    package_name: row.package_name,
    unlock_until: row.unlock_until,
    app_label: labelForPackage(row.package_name),
  }));
}
