"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { useSessionProfile } from "@/hooks/use-session-profile";
import { readActiveModeCookie } from "@/lib/role-session";

export function AppHeader({
  unreadCount = 0,
  homeHref,
  right,
}: {
  unreadCount?: number;
  /** Override home logo target (defaults from active mode cookie). */
  homeHref?: string;
  right?: React.ReactNode;
}) {
  const { profile } = useSessionProfile();
  const mode = readActiveModeCookie() ?? profile?.active_mode ?? "freelancer";
  const href =
    homeHref ?? (mode === "business" ? "/business" : "/freelancer");

  return (
    <header className="safe-top sticky top-0 z-30 bg-background px-4 pb-2.5">
      <div className="relative flex items-center justify-end gap-3">
        <Logo
          href={href}
          size="lg"
          className="absolute top-1/2 left-1/2 min-w-0 -translate-x-1/2 -translate-y-1/2"
        />

        <div className="flex shrink-0 items-center gap-1.5">
          {right}
          <Button
            variant="ghost"
            size="icon"
            className="relative size-10 text-foreground"
            asChild
          >
            <Link href="/notifications" aria-label="Notifications">
              <Bell className="size-[22px] stroke-[1.75]" />
              {unreadCount > 0 ? (
                <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
