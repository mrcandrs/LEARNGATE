/**
 * Maps Supabase / network errors to short, user-friendly copy (Phase 6 polish).
 */
export function formatAppError(error: unknown): string {
  if (error == null) {
    return "Something went wrong. Please try again.";
  }

  const status = readErrorStatus(error);
  const raw = readErrorText(error);
  const msg = raw.toLowerCase();

  if (status === 504 || status === 502 || status === 503 || msg.includes("504") || msg.includes("gateway timeout") || msg.includes("gateway time-out")) {
    return "Could not send email (server timed out). In Supabase → Authentication → Emails, set Outlook SMTP port to 587 (not 464), save, then try again.";
  }

  if (msg.includes("network") || msg.includes("fetch") || msg.includes("internet") || msg.includes("failed to fetch") || msg.includes("offline") || msg.includes("timeout") || msg.includes("timed out")) {
    return "No internet connection. Saved data stays on this device — it'll sync when you're back online.";
  }
  if (
    msg.includes("jwt expired") ||
    msg.includes("invalid jwt") ||
    msg.includes("refresh token") ||
    msg.includes("session expired") ||
    msg.includes("session missing")
  ) {
    return "Your session expired. Please sign in again.";
  }
  if (msg.includes("permission") || msg.includes("policy") || msg.includes("row-level")) {
    return "You do not have permission to do that.";
  }
  if (msg.includes("storage") || msg.includes("bucket")) {
    return "Could not upload or load the file. Check Storage setup and try again.";
  }

  if (raw.trim().startsWith("{") && raw.includes("status")) {
    return "Something went wrong. Please try again.";
  }

  return raw.length > 120 ? `${raw.slice(0, 117)}…` : raw;
}

function readErrorStatus(error: unknown): number | null {
  if (typeof error !== "object" || error == null) {
    return null;
  }
  const record = error as { status?: unknown; statusCode?: unknown };
  if (typeof record.status === "number") {
    return record.status;
  }
  if (typeof record.statusCode === "number") {
    return record.statusCode;
  }
  return null;
}

function readErrorText(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (typeof error !== "object" || error == null) {
    return String(error);
  }
  if ("message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
