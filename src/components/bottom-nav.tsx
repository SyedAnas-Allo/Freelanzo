"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Briefcase,
  Home,
  MessageSquare,
  Plus,
  Search,
  User,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserMode } from "@/types/database";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  match?: (path: string) => boolean;
  badge?: number;
};

export function BottomNav({
  mode,
  messageUnreadCount = 0,
}: {
  mode: UserMode;
  messageUnreadCount?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const unread = messageUnreadCount;

  // Job detail, attendance, and chat thread are chrome-light (no bottom menu)
  if (
    /^\/freelancer\/jobs\/[^/]+$/.test(pathname) ||
    /^\/freelancer\/jobs\/[^/]+\/(check-in|check-out|payment)$/.test(pathname) ||
    /^\/messages\/[^/]+$/.test(pathname)
  ) {
    return null;
  }

  const items: NavItem[] =
    mode === "business"
      ? [
          {
            href: "/business",
            label: "Home",
            icon: Home,
            match: (p) => p === "/business",
          },
          {
            href: "/business/jobs",
            label: "Gigs",
            icon: Briefcase,
            match: (p) =>
              p.startsWith("/business/jobs") &&
              !p.includes("/business/jobs/new"),
          },
          {
            href: "/business/jobs/new",
            label: "Hire",
            icon: Plus,
            match: (p) => p.startsWith("/business/jobs/new"),
          },
          {
            href: "/messages",
            label: "Messages",
            icon: MessageSquare,
            badge: unread,
          },
          {
            href: "/profile",
            label: "Profile",
            icon: User,
          },
        ]
      : [
          {
            href: "/freelancer/my-jobs",
            label: "My Gigs",
            icon: Briefcase,
            match: (p) => p.startsWith("/freelancer/my-jobs"),
          },
          {
            href: "/messages",
            label: "Messages",
            icon: MessageSquare,
            badge: unread,
          },
          {
            href: "/freelancer",
            label: "Find",
            icon: Search,
            match: (p) =>
              p === "/freelancer" || p.startsWith("/freelancer/jobs/"),
          },
          {
            href: "/freelancer/earnings",
            label: "Earnings",
            icon: Wallet,
            match: (p) => p.startsWith("/freelancer/earnings"),
          },
          {
            href: "/profile",
            label: "Profile",
            icon: User,
          },
        ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[430px] border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
      <ul className="grid h-14 grid-cols-5 items-end px-1">
        {items.map((item, index) => {
          const active = item.match
            ? item.match(pathname)
            : pathname.startsWith(item.href);
          const isFab = index === 2;
          const Icon = item.icon;

          if (isFab) {
            return (
              <li key={item.label} className="relative flex justify-center">
                <Link
                  href={item.href}
                  className="-mt-4 flex flex-col items-center gap-0.5"
                  onPointerEnter={() => router.prefetch(item.href)}
                  onTouchStart={() => router.prefetch(item.href)}
                >
                  <span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-background">
                    <Icon className="size-5" />
                  </span>
                  <span className="text-[10px] font-semibold text-primary">
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          }

          return (
            <li key={item.label}>
              <Link
                href={item.href}
                onPointerEnter={() => router.prefetch(item.href)}
                onTouchStart={() => router.prefetch(item.href)}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 py-1.5 text-[10px] font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span className="relative">
                  <Icon className={cn("size-5", active && "stroke-[2.5px]")} />
                  {item.badge && item.badge > 0 ? (
                    <span className="absolute -top-1.5 -right-2 flex size-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white">
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  ) : null}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
