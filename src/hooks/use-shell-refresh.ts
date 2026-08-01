"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useEffectEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ShellBadges = {
  unreadCount: number;
  messageUnreadCount: number;
};

/**
 * Keeps AppShell badges fresh without a full RSC `router.refresh()` on every
 * navigation. Revalidates lightly via the browser Supabase client on route
 * change + tab focus.
 */
export function useShellBadges(initial: ShellBadges): ShellBadges {
  const pathname = usePathname();
  const [badges, setBadges] = useState(initial);

  const refreshBadges = useCallback(async () => {
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

  const onPathOrVisible = useEffectEvent(() => {
    void refreshBadges();
  });

  useEffect(() => {
    // Initial mount + subsequent in-app navigations (async badge fetch).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on route change
    onPathOrVisible();
  }, [pathname]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") {
        onPathOrVisible();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return badges;
}
