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

type SessionListener = (data: SessionProfile) => void;
const listeners = new Set<SessionListener>();

function subscribeSessionProfile(listener: SessionListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function publishSessionProfile(data: SessionProfile) {
  memoryCache = { data, at: Date.now() };
  listeners.forEach((listener) => listener(data));
}

/** Clear cache only (e.g. logout). Does not refetch or notify. */
export function invalidateSessionProfile() {
  memoryCache = null;
  inflight = null;
}

/**
 * Force-refetch session and push into every mounted SessionProfileProvider.
 * Call after profile / business mutations before navigating to gated routes.
 */
export async function refreshSessionProfile(): Promise<SessionProfile> {
  const next = await fetchSessionProfile({ force: true });
  publishSessionProfile(next);
  return next;
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

/**
 * Session for business-gated screens. If cached business is missing, force
 * refresh once so a recent setup cannot bounce to /business/setup forever.
 */
export async function fetchBusinessSession(): Promise<SessionProfile> {
  const cached = await fetchSessionProfile();
  if (cached.business || !cached.user) return cached;
  return refreshSessionProfile();
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

  const reload = useCallback(async () => refreshSessionProfile(), []);

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

  useEffect(() => {
    return subscribeSessionProfile((next) => {
      setState(next);
      setLoading(false);
    });
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

  const reload = useCallback(async () => refreshSessionProfile(), []);

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

  useEffect(() => {
    if (ctx) return;
    return subscribeSessionProfile((next) => {
      setState(next);
      setLoading(false);
    });
  }, [ctx]);

  if (ctx) return ctx;
  return { ...state, loading, reload };
}
