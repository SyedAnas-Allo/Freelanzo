import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  getSupabasePublishableKey,
  getSupabaseUrl,
} from "@/lib/supabase/env";

export function isNativeWebView(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as Window & {
    __FREELANZO_NATIVE__?: boolean;
    ReactNativeWebView?: unknown;
  };
  return Boolean(w.__FREELANZO_NATIVE__ || w.ReactNativeWebView);
}

/**
 * PKCE via localStorage — cookies often vanish when Android Custom Tabs /
 * iOS SFSafariViewController background the WebView mid-OAuth.
 */
export function createNativePkceClient() {
  return createSupabaseJsClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    auth: {
      flowType: "pkce",
      detectSessionInUrl: false,
      persistSession: true,
      storageKey: "freelanzo-native-auth",
      storage: {
        getItem: (key) =>
          typeof window === "undefined"
            ? null
            : window.localStorage.getItem(key),
        setItem: (key, value) => {
          if (typeof window !== "undefined") {
            window.localStorage.setItem(key, value);
          }
        },
        removeItem: (key) => {
          if (typeof window !== "undefined") {
            window.localStorage.removeItem(key);
          }
        },
      },
    },
  });
}

/** Use localStorage PKCE in the app WebView; cookies everywhere else. */
export function createLoginClient() {
  return isNativeWebView() ? createNativePkceClient() : createClient();
}

function isPkceMissingError(message: string | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("code verifier") ||
    lower.includes("pkce") ||
    lower.includes("both auth code and code verifier")
  );
}

/**
 * Exchange the OAuth code in the WebView, then mirror the session into
 * @supabase/ssr cookies so Next middleware / server components see it.
 */
export async function completeNativeOAuth(code: string) {
  const native = createNativePkceClient();
  const { data, error } = await native.auth.exchangeCodeForSession(code);

  // Older builds may have started OAuth with cookie storage.
  if (error && isPkceMissingError(error.message)) {
    const browser = createClient();
    const fallback = await browser.auth.exchangeCodeForSession(code);
    if (!fallback.error && fallback.data.session) {
      return { error: null };
    }
    return { error: fallback.error ?? error };
  }

  if (error) return { error };
  if (!data.session) {
    return { error: new Error("No session returned from code exchange") };
  }

  const browser = createClient();
  const { error: setError } = await browser.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });

  return { error: setError };
}
