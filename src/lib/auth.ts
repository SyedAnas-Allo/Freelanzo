import { createClient } from "@/lib/supabase/server";
import type { Profile, BusinessProfile } from "@/types/database";

export async function getSessionProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null, business: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  let business: BusinessProfile | null = null;
  if (profile) {
    const { data } = await supabase
      .from("business_profiles")
      .select("*")
      .eq("owner_id", user.id)
      .maybeSingle();
    business = data;
  }

  return {
    user,
    profile: profile as Profile | null,
    business,
  };
}
