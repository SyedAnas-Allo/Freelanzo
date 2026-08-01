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
    <header className="sticky top-0 z-30 bg-background px-4 py-2.5">
      <div className="relative flex items-center justify-end gap-3">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto">
            <Logo href="/freelancer" size="lg" />
          </div>
        </div>

        <div className="relative z-10 flex min-w-11 items-center justify-end gap-1">
          {right}
          <Button variant="ghost" size="icon" className="relative" asChild>
            <Link href="/notifications" aria-label="Notifications">
              <Bell className="size-6" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
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
