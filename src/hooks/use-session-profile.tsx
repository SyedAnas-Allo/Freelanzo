"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
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

const CACHE_TTL_MS = 60_000;

let memoryCache: { data: SessionProfile; at: number } | null = null;
let inflight: Promise<SessionProfile> | null = null;

export function invalidateSessionProfile() {
  memoryCache = null;
  inflight = null;
}

export async function fetchSessionProfile(options?: {
  force?: boolean;
}): Promise<SessionProfile> {
  const force = options?.force === true;
  if (
    !force &&
    memoryCache &&
    Date.now() - memoryCache.at < CACHE_TTL_MS
  ) {
    return memoryCache.data;
  }
  if (!force && inflight) return inflight;

  inflight = (async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    if (!user) {
      const empty = { user: null, profile: null, business: null };
      memoryCache = { data: empty, at: Date.now() };
      return empty;
    }

    const [{ data: profile }, { data: business }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase
        .from("business_profiles")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle(),
    ]);

    const next: SessionProfile = {
      user,
      profile: profile as Profile | null,
      business: (business as BusinessProfile | null) ?? null,
    };
    memoryCache = { data: next, at: Date.now() };
    return next;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

const SessionProfileContext = createContext<UseSessionProfileResult | null>(
  null,
);

/** Mount once in AppShell so every page shares one session fetch. */
export function SessionProfileProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionProfile>(
    () => memoryCache?.data ?? { user: null, profile: null, business: null },
  );
  const [loading, setLoading] = useState(() => !memoryCache);

  const reload = useCallback(async () => {
    const next = await fetchSessionProfile({ force: true });
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

  const value = useMemo(
    () => ({ ...state, loading, reload }),
    [state, loading, reload],
  );

  return (
    <SessionProfileContext.Provider value={value}>
      {children}
    </SessionProfileContext.Provider>
  );
}

/**
 * Shared session/profile. Prefer this inside (app) — hits the provider cache
 * instead of re-querying Supabase on every page mount.
 */
export function useSessionProfile(): UseSessionProfileResult {
  const ctx = useContext(SessionProfileContext);
  const [state, setState] = useState<SessionProfile>(
    () => memoryCache?.data ?? { user: null, profile: null, business: null },
  );
  const [loading, setLoading] = useState(() => !memoryCache);

  const reload = useCallback(async () => {
    const next = await fetchSessionProfile({ force: true });
    setState(next);
    setLoading(false);
    return next;
  }, []);

  useEffect(() => {
    if (ctx) return;
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
  }, [ctx]);

  if (ctx) return ctx;
  return { ...state, loading, reload };
}
