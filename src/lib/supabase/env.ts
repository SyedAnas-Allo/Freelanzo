/**
 * Supabase API keys.
 *
 * Prefer publishable / secret keys (`sb_publishable_…`, `sb_secret_…`).
 * Legacy JWT `anon` / `service_role` keys still work until end of 2026
 * (local CLI still emits those JWT values — put them in the new env names).
 *
 * @see https://supabase.com/docs/guides/getting-started/api-keys
 */
export function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  return url;
}

/** Client-safe key: publishable, with legacy anon fallback. */
export function getSupabasePublishableKey() {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or legacy NEXT_PUBLIC_SUPABASE_ANON_KEY)",
    );
  }
  return key;
}

/** Server-only elevated key: secret, with legacy service_role fallback. */
export function getSupabaseSecretKey() {
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY)",
    );
  }
  return key;
}
