"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { NETWORK_CHANGE_EVENT } from "@/hooks/use-network-status";
import { createClient } from "@/lib/supabase/client";

type ShellBadges = {
  unreadCount: number;
  messageUnreadCount: number;
};

export type BadgesRefreshDetail = {
  unreadCount?: number;
  decrementUnread?: number;
};

const MIN_REFRESH_MS = 20_000;
export const BADGES_REFRESH_EVENT = "freelanzo-badges-refresh";
const FOREGROUND_EVENT = "freelanzo-foreground";

/** Ask the shell to refetch badge counts, optionally applying an optimistic unread value first. */
export function requestBadgesRefresh(detail?: BadgesRefreshDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BADGES_REFRESH_EVENT, { detail }));
}

function applyOptimisticUnread(
  prev: number,
  detail: BadgesRefreshDetail | undefined,
): number {
  if (typeof detail?.unreadCount === "number") return Math.max(0, detail.unreadCount);
  if (typeof detail?.decrementUnread === "number") {
    return Math.max(0, prev - detail.decrementUnread);
  }
  return prev;
}

/**
 * Badge counts: load on mount, refresh in realtime, and catch up when the app
 * returns to the foreground. The interval covers WebViews that suspend sockets.
 */
export function useShellBadges(initial: ShellBadges): ShellBadges & {
  refreshBadges: (force?: boolean) => Promise<void>;
} {
  const [badges, setBadges] = useState(initial);
  const lastRefreshAt = useRef(0);
  const refreshInFlight = useRef<Promise<void> | null>(null);
  const refreshGeneration = useRef(0);

  const refreshBadges = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastRefreshAt.current < MIN_REFRESH_MS) return;
    // Foreground, visibility, and native network events can arrive together.
    // A forced refresh should bypass the time throttle, not duplicate an
    // identical request that is already in flight.
    if (refreshInFlight.current) return refreshInFlight.current;

    const generation = ++refreshGeneration.current;
    lastRefreshAt.current = now;

    const request = (async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user || generation !== refreshGeneration.current) return;

      const [{ count }, { data: messageUnread }] = await Promise.all([
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .is("read_at", null),
        supabase.rpc("job_chat_unread_total"),
      ]);

      if (generation !== refreshGeneration.current) return;

      setBadges({
        unreadCount: count ?? 0,
        messageUnreadCount: (messageUnread as number | null) ?? 0,
      });
    })();
    refreshInFlight.current = request;
    try {
      await request;
    } finally {
      if (refreshInFlight.current === request) {
        refreshInFlight.current = null;
      }
    }
  }, []);

  const onVisible = useEffectEvent(() => {
    void refreshBadges(true);
  });

  useEffect(() => {
    void refreshBadges(true);
  }, [refreshBadges]);

  useEffect(() => {
    function handleVisible() {
      if (document.visibilityState === "visible") {
        onVisible();
      }
    }
    function handleForeground() {
      onVisible();
    }
    function handleOnline() {
      onVisible();
    }
    function handleNetwork(event: Event) {
      const detail = (event as CustomEvent<{ online?: boolean }>).detail;
      if (detail?.online) onVisible();
    }
    function handleBadgesRefresh(event: Event) {
      const detail =
        event instanceof CustomEvent
          ? (event.detail as BadgesRefreshDetail | undefined)
          : undefined;
      if (detail) {
        setBadges((prev) => ({
          ...prev,
          unreadCount: applyOptimisticUnread(prev.unreadCount, detail),
        }));
      }
      onVisible();
    }
    document.addEventListener("visibilitychange", handleVisible);
    window.addEventListener(FOREGROUND_EVENT, handleForeground);
    window.addEventListener("online", handleOnline);
    window.addEventListener(NETWORK_CHANGE_EVENT, handleNetwork);
    window.addEventListener(BADGES_REFRESH_EVENT, handleBadgesRefresh);
    return () => {
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener(FOREGROUND_EVENT, handleForeground);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener(NETWORK_CHANGE_EVENT, handleNetwork);
      window.removeEventListener(BADGES_REFRESH_EVENT, handleBadgesRefresh);
    };
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let channel: ReturnType<typeof supabase.channel> | undefined;

    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void refreshBadges(true);
      }, 250);
    };

    async function subscribe() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled || !session?.user) return;
      if (session.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }
      if (cancelled) return;

      channel = supabase
        .channel(`shell-badges:${session.user.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "job_messages" },
          scheduleRefresh,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${session.user.id}`,
          },
          scheduleRefresh,
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            try {
              supabase.realtime.connect();
            } catch {
              // The foreground refresh and poll will catch up.
            }
          }
        });
    }

    void subscribe();
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshBadges(true);
      }
    }, MIN_REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(poll);
      if (timer) clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [refreshBadges]);

  return { ...badges, refreshBadges };
}
