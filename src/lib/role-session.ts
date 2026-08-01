/** Session cookie: role was chosen after this login. Cleared on logout. */
export const ROLE_READY_COOKIE = "freelanzo_role_ready";
/** Mirrors profiles.active_mode so middleware can skip a DB round-trip. */
export const ACTIVE_MODE_COOKIE = "freelanzo_active_mode";

export type SessionMode = "freelancer" | "business";

export function setRoleReadyCookie(mode?: SessionMode) {
  document.cookie = `${ROLE_READY_COOKIE}=1; path=/; SameSite=Lax`;
  if (mode) {
    document.cookie = `${ACTIVE_MODE_COOKIE}=${mode}; path=/; SameSite=Lax`;
  }
}

export function setActiveModeCookie(mode: SessionMode) {
  document.cookie = `${ACTIVE_MODE_COOKIE}=${mode}; path=/; SameSite=Lax`;
}

export function clearRoleReadyCookie() {
  document.cookie = `${ROLE_READY_COOKIE}=; path=/; Max-Age=0; SameSite=Lax`;
  document.cookie = `${ACTIVE_MODE_COOKIE}=; path=/; Max-Age=0; SameSite=Lax`;
}

export function readActiveModeCookie(): SessionMode | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${ACTIVE_MODE_COOKIE}=([^;]*)`),
  );
  const value = match?.[1];
  return value === "business" || value === "freelancer" ? value : null;
}
