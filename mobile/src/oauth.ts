import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { WEB_URL } from "./config";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_HOSTS = [
  "accounts.google.com",
  "accounts.google.co.",
  "googleapis.com",
];

const SUPABASE_AUTH_PATH = "/auth/v1/authorize";

/** Where Supabase should send the user after Google auth (must be allow-listed). */
export function getWebsiteOAuthRedirect(): string {
  return `${WEB_URL}/auth/callback`;
}

/**
 * AuthSession completion URL — same as the website callback so the system
 * browser closes when Supabase redirects there (not localhost / Site URL).
 */
export function getAuthSessionRedirectUrl(): string {
  return getWebsiteOAuthRedirect();
}

export function isOAuthUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (GOOGLE_HOSTS.some((h) => host === h || host.startsWith(h))) {
      return true;
    }
    if (
      host.includes("supabase.co") &&
      parsed.pathname.includes(SUPABASE_AUTH_PATH)
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Force Supabase authorize links to return to the real site, never localhost. */
export function withWebsiteOAuthRedirect(url: string): string {
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname.includes("supabase.co") &&
      parsed.pathname.includes(SUPABASE_AUTH_PATH)
    ) {
      parsed.searchParams.set("redirect_to", getWebsiteOAuthRedirect());
      return parsed.toString();
    }
  } catch {
    // keep original
  }
  return url;
}

export function isNativeAuthCallback(url: string): boolean {
  try {
    const parsed = Linking.parse(url);
    const path = (parsed.path ?? "").replace(/^\//, "");
    return path === "auth/callback" || path.endsWith("/auth/callback");
  } catch {
    return false;
  }
}

function codeFromQuery(
  query: Record<string, string | string[] | undefined> | null | undefined,
): string | null {
  if (!query) return null;
  const code = query.code;
  return typeof code === "string" && code.length > 0 ? code : null;
}

function websiteCallbackWithCode(code: string, next?: string): string {
  const target = new URL(`${WEB_URL}/auth/callback`);
  target.searchParams.set("code", code);
  target.searchParams.set(
    "next",
    next && next.length > 0 ? next : "/continue",
  );
  return target.toString();
}

/**
 * Turn a native deep-link callback (with ?code=) into the website callback
 * so the Next.js route can exchange the code and set session cookies in the WebView.
 */
export function websiteCallbackFromNativeUrl(url: string): string | null {
  try {
    const parsed = Linking.parse(url);
    const code = codeFromQuery(
      parsed.queryParams as Record<string, string | string[] | undefined>,
    );
    if (!code) return null;
    const next = parsed.queryParams?.next;
    return websiteCallbackWithCode(
      code,
      typeof next === "string" ? next : undefined,
    );
  } catch {
    return null;
  }
}

export function isWebsiteAuthCallback(url: string): boolean {
  try {
    const parsed = new URL(url);
    const base = new URL(WEB_URL);
    return (
      parsed.origin === base.origin &&
      parsed.pathname.startsWith("/auth/callback")
    );
  } catch {
    return false;
  }
}

/**
 * Catch bad returns like http://localhost:3000/?code=… (Supabase Site URL)
 * and rewrite them onto the real /auth/callback.
 */
export function extractAuthCodeUrl(url: string): string | null {
  try {
    // Deep links (freelanzo://, exp://)
    if (!/^https?:/i.test(url)) {
      return websiteCallbackFromNativeUrl(url);
    }

    const parsed = new URL(url);
    const code = parsed.searchParams.get("code");
    if (!code) return null;

    const next = parsed.searchParams.get("next") ?? undefined;
    const onWebsiteCallback =
      parsed.origin === new URL(WEB_URL).origin &&
      parsed.pathname.startsWith("/auth/callback");

    if (onWebsiteCallback) {
      return url;
    }

    // localhost Site URL fallback, wrong path, etc.
    return websiteCallbackWithCode(code, next ?? undefined);
  } catch {
    return null;
  }
}

export async function openOAuthInSystemBrowser(
  url: string,
): Promise<{ type: "success"; url: string } | { type: "dismiss" }> {
  const authorizeUrl = withWebsiteOAuthRedirect(url);
  const redirectUrl = getAuthSessionRedirectUrl();
  const result = await WebBrowser.openAuthSessionAsync(
    authorizeUrl,
    redirectUrl,
    {
      showInRecents: true,
      preferEphemeralSession: false,
    },
  );

  if (result.type === "success" && result.url) {
    return { type: "success", url: result.url };
  }
  return { type: "dismiss" };
}

export function resolveAuthReturnUrl(url: string): string | null {
  return extractAuthCodeUrl(url);
}
