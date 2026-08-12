"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { Logo } from "@/components/logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  const { profile, business } = useSessionProfile();
  const mode = readActiveModeCookie() ?? profile?.active_mode ?? "freelancer";
  const href =
    homeHref ?? (mode === "business" ? "/business" : "/freelancer");

  const photoUrl =
    mode === "business"
      ? business?.logo_url || profile?.photo_url
      : profile?.photo_url;
  const name =
    mode === "business"
      ? business?.business_name || profile?.full_name || "?"
      : profile?.full_name || "?";
  const initial = name.trim().slice(0, 1).toUpperCase() || "?";

  return (
    <header className="sticky top-0 z-30 bg-background px-4 pt-3 pb-2.5">
      <div className="flex items-center justify-between gap-3">
        <Logo href={href} size="lg" className="min-w-0 shrink" />

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

          <Link
            href="/profile"
            aria-label="Profile"
            className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <Avatar className="size-9 border-[2.5px] border-primary shadow-sm">
              <AvatarImage src={photoUrl ?? undefined} alt={name} />
              <AvatarFallback className="bg-primary/10 text-sm font-bold text-primary">
                {initial}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>
    </header>
  );
}
