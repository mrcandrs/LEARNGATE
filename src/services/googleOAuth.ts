import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { makeRedirectUri } from "expo-auth-session";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Same path must be allowed in Supabase Dashboard → Authentication → URL Configuration → Redirect URLs. */
const OAUTH_PATH = "auth/callback";

export function getOAuthRedirectUri(): string {
  return makeRedirectUri({ scheme: "learngate", path: OAUTH_PATH });
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

function parseCallbackUrl(callbackUrl: string): { code: string | null; access_token: string | null; refresh_token: string | null; error: string | null } {
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

/**
 * Opens the system browser for Google OAuth and exchanges the redirect for a Supabase session.
 * Requires: Supabase → Auth → Google enabled; Redirect URLs include `getOAuthRedirectUri()` output.
 */
export async function signInWithGoogleOAuth(supabase: SupabaseClient): Promise<{ error: Error | null }> {
  const redirectTo = getOAuthRedirectUri();

  if (__DEV__) {
    // Copy this value into Supabase "Redirect URLs" if sign-in fails with redirect_mismatch.
    console.log("[LearnGate] OAuth redirectTo:", redirectTo);
  }

  const { data, error: oauthUrlError } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (oauthUrlError || !data?.url) {
    return { error: oauthUrlError ?? new Error("Could not start Google sign-in.") };
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type !== "success" || !result.url) {
    return { error: result.type === "dismiss" ? new Error("Sign-in was cancelled.") : new Error("Google sign-in did not complete.") };
  }

  const { code, access_token, refresh_token, error: urlError } = parseCallbackUrl(result.url);

  if (urlError) {
    return { error: new Error(decodeURIComponent(urlError.replace(/\+/g, " "))) };
  }

  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    return { error: exchangeError ?? null };
  }

  if (access_token && refresh_token) {
    const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
    return { error: sessionError ?? null };
  }

  return { error: new Error("No auth code or tokens in redirect. Check Supabase redirect URL allow list.") };
}
