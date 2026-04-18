/**
 * Maps Supabase / network errors to short, user-friendly copy (Phase 6 polish).
 */
export function formatAppError(error: unknown): string {
  if (error == null) {
    return "Something went wrong. Please try again.";
  }

  const raw =
    typeof error === "string"
      ? error
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);

  const msg = raw.toLowerCase();

  if (msg.includes("network") || msg.includes("fetch") || msg.includes("internet") || msg.includes("failed to fetch")) {
    return "No internet connection. Check your network and try again.";
  }
  if (msg.includes("jwt") || msg.includes("session") || msg.includes("auth")) {
    return "Your session expired. Please sign in again.";
  }
  if (msg.includes("permission") || msg.includes("policy") || msg.includes("row-level")) {
    return "You do not have permission to do that.";
  }
  if (msg.includes("storage") || msg.includes("bucket")) {
    return "Could not upload or load the file. Check Storage setup and try again.";
  }

  return raw.length > 120 ? `${raw.slice(0, 117)}…` : raw;
}
