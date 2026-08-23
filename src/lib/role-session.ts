/** Session cookie: role was chosen after this login. Cleared on logout. */
export const ROLE_READY_COOKIE = "freelanzo_role_ready";
/** Mirrors profiles.active_mode so middleware can skip a DB round-trip. */
export const ACTIVE_MODE_COOKIE = "freelanzo_active_mode";

/**
 * Keep role/mode cookies for 30 days. Session cookies (no Max-Age) die when
 * the WebView process is killed and bounce users back to the role gate.
 */
export const ROLE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type SessionMode = "freelancer" | "business";

function roleCookieAttrs(maxAge = ROLE_COOKIE_MAX_AGE_SECONDS): string {
  return `path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

export function setRoleReadyCookie(mode?: SessionMode) {
  document.cookie = `${ROLE_READY_COOKIE}=1; ${roleCookieAttrs()}`;
  if (mode) {
    document.cookie = `${ACTIVE_MODE_COOKIE}=${mode}; ${roleCookieAttrs()}`;
  }
}

export function setActiveModeCookie(mode: SessionMode) {
  document.cookie = `${ACTIVE_MODE_COOKIE}=${mode}; ${roleCookieAttrs()}`;
}

export function clearRoleReadyCookie() {
  document.cookie = `${ROLE_READY_COOKIE}=; ${roleCookieAttrs(0)}`;
  document.cookie = `${ACTIVE_MODE_COOKIE}=; ${roleCookieAttrs(0)}`;
}

export function readActiveModeCookie(): SessionMode | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${ACTIVE_MODE_COOKIE}=([^;]*)`),
  );
  const value = match?.[1];
  return value === "business" || value === "freelancer" ? value : null;
}
