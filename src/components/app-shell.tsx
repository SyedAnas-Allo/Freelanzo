"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { useShellRefresh } from "@/hooks/use-shell-refresh";
import { cn } from "@/lib/utils";
import type { UserMode } from "@/types/database";

export function AppShell({
  children,
  unreadCount,
  messageUnreadCount = 0,
  mode,
}: {
  children: React.ReactNode;
  unreadCount: number;
  messageUnreadCount?: number;
  mode: UserMode;
}) {
  const pathname = usePathname();
  useShellRefresh();
  const hideNav =
    /^\/freelancer\/jobs\/[^/]+$/.test(pathname) ||
    /^\/freelancer\/jobs\/[^/]+\/(check-in|check-out|payment)$/.test(pathname) ||
    /^\/messages\/[^/]+$/.test(pathname);

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader unreadCount={unreadCount} />
      <main className={cn("flex-1", !hideNav && "safe-bottom")}>{children}</main>
      {!hideNav ? (
        <BottomNav mode={mode} messageUnreadCount={messageUnreadCount} />
      ) : null}
    </div>
  );
}
