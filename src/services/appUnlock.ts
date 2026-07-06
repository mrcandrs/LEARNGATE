import { supabase } from "@/services/supabase";
import { formatAppError } from "@/utils/errors";
import type {
  AppUnlockRequestRow,
  TempUnlockRow,
  UnlockDuration,
  UnlockQuote,
} from "@/constants/appUnlock";

export async function fetchUnlockQuote(
  childId: string,
  packageName: string,
  duration: UnlockDuration
): Promise<UnlockQuote> {
  if (!supabase) {
    return { ok: false, reason: "Supabase is not configured." };
  }

  const { data, error } = await supabase.rpc("fn_get_unlock_quote", {
    p_child_id: childId,
    p_package_name: packageName,
    p_duration: duration,
  });

  if (error) {
    return { ok: false, reason: formatAppError(error) };
  }

  return (data ?? { ok: false, reason: "No quote returned." }) as UnlockQuote;
}

export async function requestAppUnlock(params: {
  childId: string;
  packageName: string;
  appLabel?: string;
  duration: UnlockDuration;
  message?: string;
}): Promise<{ ok: boolean; reason?: string; request_id?: string; stars_escrowed?: number }> {
  if (!supabase) {
    return { ok: false, reason: "Supabase is not configured." };
  }

  const { data, error } = await supabase.rpc("fn_request_app_unlock", {
    p_child_id: params.childId,
    p_package_name: params.packageName,
    p_app_label: params.appLabel ?? null,
    p_duration: params.duration,
    p_message: params.message ?? null,
  });

  if (error) {
    return { ok: false, reason: formatAppError(error) };
  }

  const result = data as { ok: boolean; reason?: string; request_id?: string; stars_escrowed?: number };
  return result ?? { ok: false, reason: "Request failed." };
}

export async function resolveAppUnlock(
  requestId: string,
  action: "approve" | "deny"
): Promise<{ ok: boolean; reason?: string; status?: string; unlock_until?: string; stars_refunded?: number }> {
  if (!supabase) {
    return { ok: false, reason: "Supabase is not configured." };
  }

  const { data, error } = await supabase.rpc("fn_resolve_app_unlock", {
    p_request_id: requestId,
    p_action: action,
  });

  if (error) {
    return { ok: false, reason: formatAppError(error) };
  }

  return (data ?? { ok: false, reason: "No response." }) as {
    ok: boolean;
    reason?: string;
    status?: string;
    unlock_until?: string;
    stars_refunded?: number;
  };
}

export async function fetchChildTempUnlocks(childId: string): Promise<TempUnlockRow[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase.rpc("fn_get_child_temp_unlocks", {
    p_child_id: childId,
  });

  if (error) {
    console.warn("[LearnGate] temp unlocks load failed:", error.message);
    return [];
  }

  return Array.isArray(data) ? (data as TempUnlockRow[]) : [];
}

export async function fetchPendingUnlockRequests(childIds: string[]): Promise<AppUnlockRequestRow[]> {
  if (!supabase || childIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("child_app_unlock_requests")
    .select(
      "id, child_id, package_name, app_label, duration, stars_escrowed, status, child_message, unlock_until, created_at, children(name)"
    )
    .in("child_id", childIds)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[LearnGate] pending unlock requests failed:", error.message);
    return [];
  }

  return (data as AppUnlockRequestRow[]) ?? [];
}

export async function fetchPendingUnlockForPackage(
  childId: string,
  packageName: string
): Promise<AppUnlockRequestRow | null> {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("child_app_unlock_requests")
    .select("id, child_id, package_name, app_label, duration, stars_escrowed, status, child_message, unlock_until, created_at")
    .eq("child_id", childId)
    .eq("package_name", packageName)
    .eq("status", "pending")
    .maybeSingle();

  if (error) {
    return null;
  }

  return (data as AppUnlockRequestRow) ?? null;
}
