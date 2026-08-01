import Link from "next/link";
import { Bell } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

export function AppHeader({
  unreadCount = 0,
  right,
}: {
  unreadCount?: number;
  right?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 bg-background px-4 py-1.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-10 items-center">
          <Logo href="/freelancer" size="md" />
        </div>

        <div className="flex min-w-10 items-center justify-end gap-1">
          {right}
          <Button variant="ghost" size="icon-sm" className="relative" asChild>
            <Link href="/notifications" aria-label="Notifications">
              <Bell className="size-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
