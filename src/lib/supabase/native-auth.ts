import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import type { Session } from "@supabase/supabase-js";
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
 * Drop OAuth query params only after the native exchange finished (or when
 * recovering). Never scrub at the start of the handoff — that made
 * useSearchParams remount into a false "missing credentials" error.
 */
function scrubOAuthParamsFromUrl() {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (
      !url.searchParams.has("code") &&
      !url.searchParams.has("access_token") &&
      !url.searchParams.has("refresh_token")
    ) {
      return;
    }
    url.searchParams.delete("code");
    url.searchParams.delete("access_token");
    url.searchParams.delete("refresh_token");
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

function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return new Error((error as { message: string }).message);
  }
  return new Error("Sign-in failed");
}

async function mirrorSessionToCookies(session: {
  access_token: string;
  refresh_token: string;
}) {
  scrubOAuthParamsFromUrl();
  const browser = createClient();
  return browser.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
}

/**
 * Prefer cookie session; if only the native PKCE store has one (partial
 * handoff), mirror it into cookies so middleware accepts the user.
 */
export async function recoverNativeSession(): Promise<Session | null> {
  scrubOAuthParamsFromUrl();

  const browser = createClient();
  const cookie = await browser.auth.getSession();
  if (cookie.data.session) return cookie.data.session;

  const native = createNativePkceClient();
  const local = await native.auth.getSession();
  if (!local.data.session) return null;

  const { error } = await mirrorSessionToCookies(local.data.session);
  if (error) return null;
  return local.data.session;
}

/** Wait briefly for an in-flight handoff to land a session before erroring. */
export async function waitForNativeSession(
  attempts = 10,
  delayMs = 200,
): Promise<Session | null> {
  for (let i = 0; i < attempts; i++) {
    const session = await recoverNativeSession();
    if (session) return session;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

async function exchangeNativeOAuthCode(code: string) {
  const native = createNativePkceClient();
  let { data, error } = await native.auth.exchangeCodeForSession(code);

  // WebView storage can lag briefly after returning from Custom Tabs.
  if (error && isPkceMissingError(error)) {
    await new Promise((r) => setTimeout(r, 350));
    const retry = await native.auth.exchangeCodeForSession(code);
    data = retry.data;
    error = retry.error;
  }

  // Older builds may have started OAuth with cookie storage.
  if (error && isPkceMissingError(error)) {
    scrubOAuthParamsFromUrl();
    const browser = createClient();
    const fallback = await browser.auth.exchangeCodeForSession(code);
    if (!fallback.error && fallback.data.session) {
      return { error: null };
    }
    if (await recoverNativeSession()) return { error: null };
    return { error: fallback.error ?? error };
  }

  if (error) {
    if (await recoverNativeSession()) return { error: null };
    return { error };
  }
  if (!data.session) {
    if (await recoverNativeSession()) return { error: null };
    return { error: new Error("No session returned from code exchange") };
  }

  const { error: setError } = await mirrorSessionToCookies(data.session);
  if (setError && (await recoverNativeSession())) return { error: null };
  return { error: setError };
}

type ExchangeResult = { error: Error | null };

/** Dedupe concurrent / Strict-Mode remounts so PKCE verifier is used once. */
const inflightExchanges = new Map<string, Promise<ExchangeResult>>();

/**
 * Exchange the OAuth code in the WebView, then mirror the session into
 * @supabase/ssr cookies so Next middleware / server components see it.
 */
export async function completeNativeOAuth(
  code: string,
): Promise<ExchangeResult> {
  const existing = inflightExchanges.get(code);
  if (existing) return existing;

  const pending = exchangeNativeOAuthCode(code)
    .then((result) => ({
      error: result.error ? toError(result.error) : null,
    }))
    .finally(() => {
      const clear = () => {
        if (inflightExchanges.get(code) === pending) {
          inflightExchanges.delete(code);
        }
      };
      if (typeof window !== "undefined") {
        window.setTimeout(clear, 30_000);
      } else {
        clear();
      }
    });

  inflightExchanges.set(code, pending);
  return pending;
}

/** Read OAuth handoff params from the real location (not a stale hook). */
export function readNativeHandoffParams(): {
  code: string | null;
  accessToken: string | null;
  refreshToken: string | null;
} {
  if (typeof window === "undefined") {
    return { code: null, accessToken: null, refreshToken: null };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    code: params.get("code"),
    accessToken: params.get("access_token"),
    refreshToken: params.get("refresh_token"),
  };
}
