"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { useRouter } from "@/hooks/use-app-router";
import {
  refreshSessionProfile,
  SessionProfileProvider,
} from "@/hooks/use-session-profile";
import { useShellBadges } from "@/hooks/use-shell-refresh";
import { readActiveModeCookie, setActiveModeCookie } from "@/lib/role-session";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { UserMode } from "@/types/database";

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mode, setMode] = useState<UserMode>(
    () => readActiveModeCookie() ?? "freelancer",
  );
  const [contentKey, setContentKey] = useState(0);
  const { unreadCount, messageUnreadCount, refreshBadges } = useShellBadges({
    unreadCount: 0,
    messageUnreadCount: 0,
  });
  const hideNav =
    /^\/freelancer\/jobs\/[^/]+$/.test(pathname) ||
    /^\/freelancer\/jobs\/[^/]+\/(check-in|check-out|payment)$/.test(pathname) ||
    /^\/messages\/[^/]+$/.test(pathname);

  useEffect(() => {
    // Re-read on navigation so role switches apply; cookie hit avoids a DB round-trip.
    const fromCookie = readActiveModeCookie();
    if (fromCookie) {
      setMode(fromCookie);
      return;
    }
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user || cancelled) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("active_mode")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const next =
        profile?.active_mode === "business" ? "business" : "freelancer";
      setMode(next);
      setActiveModeCookie(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const onPullRefresh = useCallback(async () => {
    await Promise.all([refreshSessionProfile(), refreshBadges(true)]);
    router.refresh();
    // Remount the route tree so client pages re-run their load effects.
    setContentKey((n) => n + 1);
    window.dispatchEvent(new Event("freelanzo-pull-refresh"));
  }, [refreshBadges, router]);

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        unreadCount={unreadCount}
        homeHref={mode === "business" ? "/business" : "/freelancer"}
      />
      <PullToRefresh onRefresh={onPullRefresh} className="flex min-h-0 flex-1 flex-col">
        <main
          key={`${pathname}:${contentKey}`}
          className={cn("flex-1", !hideNav && "safe-bottom")}
        >
          {children}
        </main>
      </PullToRefresh>
      {!hideNav ? (
        <BottomNav mode={mode} messageUnreadCount={messageUnreadCount} />
      ) : null}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SessionProfileProvider>
      <AppShellInner>{children}</AppShellInner>
    </SessionProfileProvider>
  );
}
