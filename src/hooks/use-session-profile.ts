"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { BusinessProfile, Profile } from "@/types/database";

export type SessionProfile = {
  user: User | null;
  profile: Profile | null;
  business: BusinessProfile | null;
};

type UseSessionProfileResult = SessionProfile & {
  loading: boolean;
  reload: () => Promise<SessionProfile>;
};

async function fetchSessionProfile(): Promise<SessionProfile> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
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
}

/** Browser equivalent of getSessionProfile — loads once on mount. */
export function useSessionProfile(): UseSessionProfileResult {
  const [state, setState] = useState<SessionProfile>({
    user: null,
    profile: null,
    business: null,
  });
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const next = await fetchSessionProfile();
    setState(next);
    setLoading(false);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await fetchSessionProfile();
      if (cancelled) return;
      setState(next);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { ...state, loading, reload };
}

export { fetchSessionProfile };
