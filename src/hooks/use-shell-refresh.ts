"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ShellBadges = {
  unreadCount: number;
  messageUnreadCount: number;
};

const MIN_REFRESH_MS = 20_000;

/**
 * Badge counts: load once on mount, again on tab focus, and at most every
 * 20s on navigation — not a full refetch on every route change.
 */
export function useShellBadges(initial: ShellBadges): ShellBadges & {
  refreshBadges: (force?: boolean) => Promise<void>;
} {
  const [badges, setBadges] = useState(initial);
  const lastRefreshAt = useRef(0);

  const refreshBadges = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastRefreshAt.current < MIN_REFRESH_MS) return;
    lastRefreshAt.current = now;

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    const [{ count }, { data: messageUnread }] = await Promise.all([
      supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null),
      supabase.rpc("job_chat_unread_total"),
    ]);

    setBadges({
      unreadCount: count ?? 0,
      messageUnreadCount: (messageUnread as number | null) ?? 0,
    });
  }, []);

  const onVisible = useEffectEvent(() => {
    void refreshBadges(true);
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial badge fetch
    void refreshBadges(true);
  }, [refreshBadges]);

  useEffect(() => {
    function handleVisible() {
      if (document.visibilityState === "visible") {
        onVisible();
      }
    }
    document.addEventListener("visibilitychange", handleVisible);
    return () => document.removeEventListener("visibilitychange", handleVisible);
  }, []);

  return { ...badges, refreshBadges };
}
