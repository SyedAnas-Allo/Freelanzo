import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile, BusinessProfile } from "@/types/database";

/** Per-request dedupe when layout + page both need the session. */
export const getSessionProfile = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null, business: null };

  const [{ data: profile }, { data: business }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("business_profiles")
      .select("*")
      .eq("owner_id", user.id)
      .maybeSingle(),
  ]);

  return {
    user,
    profile: profile as Profile | null,
    business: (business as BusinessProfile | null) ?? null,
  };
});
