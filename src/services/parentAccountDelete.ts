import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/services/supabase";

/** Typed confirmation phrase — must match the edge function and i18n copy. */
export const PARENT_ACCOUNT_DELETE_CONFIRMATION = "DELETE";

type DeleteParentAccountResult = { ok: true } | { ok: false; message: string };

async function readFunctionErrorDetail(error: unknown, data: unknown): Promise<string> {
  if (typeof data === "object" && data !== null && "error" in data && typeof (data as { error: unknown }).error === "string") {
    return (data as { error: string }).error;
  }

  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as { error?: string };
      if (body?.error) {
        return body.error;
      }
    } catch {
      /* fall through */
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error deleting parent account.";
}

/** Permanently deletes the signed-in parent account and all linked data. */
export async function deleteParentAccount(confirmation: string): Promise<DeleteParentAccountResult> {
  if (!supabase) {
    return { ok: false, message: "Supabase is not configured." };
  }

  if (confirmation.trim() !== PARENT_ACCOUNT_DELETE_CONFIRMATION) {
    return {
      ok: false,
      message: `Type ${PARENT_ACCOUNT_DELETE_CONFIRMATION} to confirm account deletion.`,
    };
  }

  const { data, error } = await supabase.functions.invoke("delete-parent-account", {
    body: { confirmation: confirmation.trim() },
  });

  const payload = data as { ok?: boolean; error?: string } | null;

  if (error) {
    const detail = await readFunctionErrorDetail(error, data);
    const hint = /delete-parent-account|not found|404/i.test(detail)
      ? " Deploy the function: npx supabase functions deploy delete-parent-account"
      : "";
    return { ok: false, message: `${detail}${hint}` };
  }

  if (!payload?.ok) {
    return { ok: false, message: payload?.error ?? "Could not delete account." };
  }

  return { ok: true };
}
