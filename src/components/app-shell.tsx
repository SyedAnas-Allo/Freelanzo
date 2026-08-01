"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { useShellBadges } from "@/hooks/use-shell-refresh";
import { readActiveModeCookie, setActiveModeCookie } from "@/lib/role-session";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { UserMode } from "@/types/database";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mode, setMode] = useState<UserMode>(
    () => readActiveModeCookie() ?? "freelancer",
  );
  const badges = useShellBadges({ unreadCount: 0, messageUnreadCount: 0 });
  const hideNav =
    /^\/freelancer\/jobs\/[^/]+$/.test(pathname) ||
    /^\/freelancer\/jobs\/[^/]+\/(check-in|check-out|payment)$/.test(pathname) ||
    /^\/messages\/[^/]+$/.test(pathname);

  useEffect(() => {
    let cancelled = false;
    async function syncMode() {
      const fromCookie = readActiveModeCookie();
      if (fromCookie) {
        if (!cancelled) setMode(fromCookie);
        return;
      }
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
    }
    void syncMode();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader unreadCount={badges.unreadCount} />
      <main className={cn("flex-1", !hideNav && "safe-bottom")}>{children}</main>
      {!hideNav ? (
        <BottomNav
          mode={mode}
          messageUnreadCount={badges.messageUnreadCount}
        />
      ) : null}
    </div>
  );
}
