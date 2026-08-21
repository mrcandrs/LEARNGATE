import * as Linking from "expo-linking";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { supabase } from "@/services/supabase";
import { getOAuthRedirectUri } from "@/services/googleOAuth";

export function getEmailAuthRedirectTo(): string {
  return getOAuthRedirectUri();
}

export function isEmailConfirmed(user: User | null | undefined): boolean {
  if (!user) {
    return false;
  }
  if (user.email_confirmed_at) {
    return true;
  }
  const provider = user.app_metadata?.provider;
  const providers = user.app_metadata?.providers;
  if (provider === "google" || (Array.isArray(providers) && providers.includes("google"))) {
    return true;
  }
  return false;
}

export function isParentSignupPending(user: User | null | undefined): boolean {
  if (!user) {
    return false;
  }
  if (user.user_metadata?.role === "child") {
    return false;
  }
  const pending = user.user_metadata?.signup_pending;
  return pending === true || pending === "true";
}

export function isParentEmailUnconfirmed(user: User | null | undefined): boolean {
  if (!user) {
    return false;
  }
  if (user.user_metadata?.role === "child") {
    return false;
  }
  if (isParentSignupPending(user)) {
    return false;
  }
  return !isEmailConfirmed(user);
}

function pickQueryParam(params: Record<string, string | string[] | undefined>, key: string): string | null {
  const v = params[key];
  if (typeof v === "string") {
    return v;
  }
  if (Array.isArray(v)) {
    return v[0] ?? null;
  }
  return null;
}

function parseCallbackUrl(callbackUrl: string): {
  code: string | null;
  access_token: string | null;
  refresh_token: string | null;
  error: string | null;
} {
  const parsed = Linking.parse(callbackUrl);
  const q = parsed.queryParams ?? {};
  const code = pickQueryParam(q, "code");
  let error = pickQueryParam(q, "error_description") ?? pickQueryParam(q, "error");
  let access_token: string | null = null;
  let refresh_token: string | null = null;

  const hashIdx = callbackUrl.indexOf("#");
  if (hashIdx >= 0) {
    const hash = callbackUrl.slice(hashIdx + 1);
    const params = new URLSearchParams(hash);
    access_token = params.get("access_token");
    refresh_token = params.get("refresh_token");
    error = error ?? params.get("error_description") ?? params.get("error");
  }

  return { code, access_token, refresh_token, error };
}

export function looksLikeAuthCallback(url: string): boolean {
  return (
    url.includes("auth/callback") ||
    url.includes("access_token=") ||
    url.includes("code=") ||
    url.includes("type=signup") ||
    url.includes("type=magiclink") ||
    url.includes("type=recovery") ||
    url.includes("type=email")
  );
}

export function isPasswordRecoveryUrl(url: string): boolean {
  return url.includes("type=recovery");
}

export async function completeSessionFromUrl(
  client: SupabaseClient,
  url: string
): Promise<{ error: Error | null; handled: boolean }> {
  if (!looksLikeAuthCallback(url)) {
    return { error: null, handled: false };
  }

  const { code, access_token, refresh_token, error: urlError } = parseCallbackUrl(url);
  if (urlError) {
    return { error: new Error(decodeURIComponent(urlError.replace(/\+/g, " "))), handled: true };
  }

  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    return { error: error ?? null, handled: true };
  }

  if (access_token && refresh_token) {
    const { error } = await client.auth.setSession({ access_token, refresh_token });
    return { error: error ?? null, handled: true };
  }

  return { error: null, handled: false };
}

export async function sendParentSignupVerifyEmail(email: string): Promise<{ error: Error | null }> {
  if (!supabase) {
    return { error: new Error("Supabase is not configured.") };
  }
  await supabase.auth.signOut({ scope: "local" });
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: getEmailAuthRedirectTo(),
      data: {
        role: "parent",
        signup_pending: true,
      },
    },
  });
  return { error: error ?? null };
}

export async function resendParentSignupEmail(email: string): Promise<{ error: Error | null }> {
  return sendParentSignupVerifyEmail(email);
}

export async function completeParentSignup(params: {
  fullName: string;
  password: string;
}): Promise<{ error: Error | null }> {
  if (!supabase) {
    return { error: new Error("Supabase is not configured.") };
  }
  const { error } = await supabase.auth.updateUser({
    password: params.password,
    data: {
      full_name: params.fullName,
      role: "parent",
      signup_pending: false,
    },
  });
  return { error: error ?? null };
}

export async function sendParentPasswordResetEmail(
  email: string
): Promise<{ error: Error | null; reason?: "not_registered" | "lookup_failed" }> {
  if (!supabase) {
    return { error: new Error("Supabase is not configured.") };
  }

  const normalized = email.trim().toLowerCase();
  const { data: registered, error: lookupError } = await supabase.rpc("parent_email_is_registered", {
    p_email: normalized,
  });

  if (lookupError) {
    const hint = /parent_email_is_registered|schema cache|does not exist/i.test(lookupError.message)
      ? " Run supabase/step-ap-parent-email-registered.sql in the Supabase SQL Editor."
      : "";
    return {
      error: new Error(`${lookupError.message}${hint}`),
      reason: "lookup_failed",
    };
  }

  if (!registered) {
    return {
      error: new Error("NOT_REGISTERED"),
      reason: "not_registered",
    };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(normalized, {
    redirectTo: getEmailAuthRedirectTo(),
  });
  return { error: error ?? null };
}

export async function updateParentPassword(password: string): Promise<{ error: Error | null }> {
  if (!supabase) {
    return { error: new Error("Supabase is not configured.") };
  }
  const { error } = await supabase.auth.updateUser({ password });
  return { error: error ?? null };
}

export async function signInParentWithPassword(
  email: string,
  password: string
): Promise<{ error: Error | null; status: "signed_in" | "unverified" | "incomplete_signup" }> {
  if (!supabase) {
    return { error: new Error("Supabase is not configured."), status: "unverified" };
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("not confirmed") || msg.includes("email not confirmed")) {
      await sendParentSignupVerifyEmail(email);
      return { error: null, status: "unverified" };
    }
    return { error, status: "unverified" };
  }

  if (isParentSignupPending(data.user)) {
    return { error: null, status: "incomplete_signup" };
  }

  if (!isEmailConfirmed(data.user)) {
    await supabase.auth.signOut({ scope: "local" });
    await sendParentSignupVerifyEmail(email);
    return { error: null, status: "unverified" };
  }

  return { error: null, status: "signed_in" };
}
