import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { WEB_URL } from "./config";

WebBrowser.maybeCompleteAuthSession();

export function getAppReturnDeepLink(): string {
  return "freelanzo://auth/session";
}

/** Allowlisted path + native flag (see Supabase Redirect URLs). */
export function getWebsiteNativeOAuthRedirect(): string {
  return `${WEB_URL}/auth/callback?native=1`;
}

export function isSupabaseAuthorizeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.includes("supabase.co") &&
      parsed.pathname.includes("/auth/v1/authorize")
    );
  } catch {
    return false;
  }
}

export function isGoogleUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host === "accounts.google.com" || host.startsWith("accounts.google.")
    );
  } catch {
    return false;
  }
}

export function withWebsiteNativeOAuthRedirect(url: string): string {
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname.includes("supabase.co") &&
      parsed.pathname.includes("/auth/v1/authorize")
    ) {
      parsed.searchParams.set("redirect_to", getWebsiteNativeOAuthRedirect());
      return parsed.toString();
    }
  } catch {
    // keep original
  }
  return url;
}

function parseDeepLinkParams(url: string): URLSearchParams | null {
  try {
    const normalized = url
      .replace(/^freelanzo:/i, "https:")
      .replace(/^exp[s]?:/i, "https:");
    return new URL(normalized).searchParams;
  } catch {
    try {
      const parsed = Linking.parse(url);
      const q = parsed.queryParams ?? {};
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(q)) {
        if (typeof value === "string") params.set(key, value);
      }
      return params;
    } catch {
      return null;
    }
  }
}

/**
 * freelanzo://auth/session?code=… → WebView /auth/native?code=…
 * Client page exchanges the code where the PKCE verifier lives (localStorage).
 */
export function sessionDeepLinkToWebUrl(url: string): string | null {
  try {
    if (/^intent:/i.test(url)) {
      const pathAndQuery = url.replace(/^intent:\/\//i, "").split("#")[0] ?? "";
      url = `freelanzo://${pathAndQuery}`;
    }

    if (!/^freelanzo:\/\//i.test(url) && !/^exp[s]?:\/\//i.test(url)) {
      return null;
    }

    const params = parseDeepLinkParams(url);
    if (!params) return null;

    const code = params.get("code");
    if (code) {
      const target = new URL(`${WEB_URL}/auth/native`);
      target.searchParams.set("code", code);
      return target.toString();
    }

    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (access_token && refresh_token) {
      const target = new URL(`${WEB_URL}/auth/native`);
      target.searchParams.set("access_token", access_token);
      target.searchParams.set("refresh_token", refresh_token);
      return target.toString();
    }

    return null;
  } catch {
    return null;
  }
}

export function codeUrlToWebsiteCallback(url: string): string | null {
  try {
    if (!/^https?:/i.test(url)) return null;
    const parsed = new URL(url);
    const code = parsed.searchParams.get("code");
    if (!code) return null;
    if (parsed.searchParams.get("native") === "1") return null;
    const target = new URL(`${WEB_URL}/auth/native`);
    target.searchParams.set("code", code);
    return target.toString();
  } catch {
    return null;
  }
}

export async function openOAuthInSystemBrowser(
  url: string,
): Promise<string | null> {
  const authorizeUrl = withWebsiteNativeOAuthRedirect(url);
  const returnUrl = getAppReturnDeepLink();

  try {
    const result = await WebBrowser.openAuthSessionAsync(
      authorizeUrl,
      returnUrl,
      { preferEphemeralSession: false },
    );

    if (result.type === "success" && result.url) {
      return (
        sessionDeepLinkToWebUrl(result.url) ??
        codeUrlToWebsiteCallback(result.url)
      );
    }
  } catch (e) {
    console.warn("openAuthSessionAsync failed", e);
  }
  return null;
}
