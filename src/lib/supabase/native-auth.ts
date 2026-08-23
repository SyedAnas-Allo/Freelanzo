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

function isPkceMissingError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    const message =
      typeof error === "string"
        ? error
        : error instanceof Error
          ? error.message
          : "";
    if (!message) return false;
    const lower = message.toLowerCase();
    return (
      lower.includes("code verifier") ||
      lower.includes("pkce") ||
      lower.includes("both auth code and code verifier")
    );
  }

  const code =
    "code" in error && typeof error.code === "string" ? error.code : "";
  const message =
    "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  const lower = message.toLowerCase();
  return (
    code === "pkce_code_verifier_not_found" ||
    lower.includes("code verifier") ||
    lower.includes("pkce") ||
    lower.includes("both auth code and code verifier")
  );
}

/**
 * Drop `?code=` before touching the cookie client. createBrowserClient is a
 * singleton with detectSessionInUrl=true; leaving the code in the URL makes
 * init try a second PKCE exchange (no cookie verifier) and race the handoff.
 */
function scrubOAuthCodeFromUrl() {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("code")) return;
    url.searchParams.delete("code");
    const qs = url.searchParams.toString();
    window.history.replaceState(
      {},
      "",
      `${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`,
    );
  } catch {
    // ignore
  }
}

async function mirrorSessionToCookies(session: {
  access_token: string;
  refresh_token: string;
}) {
  const browser = createClient();
  return browser.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
}

async function exchangeNativeOAuthCode(code: string) {
  // Code is passed explicitly; leave it out of the URL so the cookie
  // singleton never auto-exchanges mid-handoff.
  scrubOAuthCodeFromUrl();

  const native = createNativePkceClient();
  let { data, error } = await native.auth.exchangeCodeForSession(code);

  // WebView storage can lag briefly after returning from Custom Tabs.
  if (error && isPkceMissingError(error)) {
    await new Promise((r) => setTimeout(r, 250));
    const retry = await native.auth.exchangeCodeForSession(code);
    data = retry.data;
    error = retry.error;
  }

  // Older builds may have started OAuth with cookie storage.
  if (error && isPkceMissingError(error)) {
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

  const { error: setError } = await mirrorSessionToCookies(data.session);
  return { error: setError };
}

type ExchangeResult = { error: Error | null };

/** Dedupe concurrent / Strict-Mode remounts so PKCE verifier is used once. */
const inflightExchanges = new Map<string, Promise<ExchangeResult>>();

/**
 * Exchange the OAuth code in the WebView, then mirror the session into
 * @supabase/ssr cookies so Next middleware / server components see it.
 */
export async function completeNativeOAuth(code: string): Promise<ExchangeResult> {
  const existing = inflightExchanges.get(code);
  if (existing) return existing;

  const pending = exchangeNativeOAuthCode(code)
    .then((result) => ({
      error: result.error
        ? result.error instanceof Error
          ? result.error
          : new Error(
              typeof result.error === "object" &&
                result.error &&
                "message" in result.error
                ? String((result.error as { message: unknown }).message)
                : "Sign-in failed",
            )
        : null,
    }))
    .finally(() => {
      // Keep the settled promise briefly so a remount awaits the same result
      // instead of starting a second exchange after the verifier is gone.
      const clear = () => {
        if (inflightExchanges.get(code) === pending) {
          inflightExchanges.delete(code);
        }
      };
      if (typeof window !== "undefined") {
        window.setTimeout(clear, 10_000);
      } else {
        clear();
      }
    });

  inflightExchanges.set(code, pending);
  return pending;
}
