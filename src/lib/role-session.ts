/** Session cookie: role was chosen after this login. Cleared on logout. */
export const ROLE_READY_COOKIE = "freelanzo_role_ready";

export function setRoleReadyCookie() {
  document.cookie = `${ROLE_READY_COOKIE}=1; path=/; SameSite=Lax`;
}

export function clearRoleReadyCookie() {
  document.cookie = `${ROLE_READY_COOKIE}=; path=/; Max-Age=0; SameSite=Lax`;
}
