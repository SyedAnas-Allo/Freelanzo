import {
  Bell,
  CheckCircle2,
  Clock,
  Megaphone,
  UserPlus,
  Wallet,
} from "lucide-react";
import { NotificationItem } from "@/components/notification-item";
import { notificationHref } from "@/lib/notification-href";
import type { Notification, UserMode } from "@/types/database";

export function NotificationSection({
  title,
  rows,
  mode,
}: {
  title: string;
  rows: Notification[];
  mode: UserMode;
}) {
  if (!rows.length) return null;

  return (
    <section className="mt-5">
      <h2 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      <div className="mt-2 space-y-2">
        {rows.map((notification) => {
          const { Icon, className } = iconFor(notification.type);
          return (
            <NotificationItem
              key={notification.id}
              id={notification.id}
              href={notificationHref(notification, mode)}
              className={`flex gap-3 rounded-xl border bg-card p-3 shadow-sm transition-colors active:bg-muted/40 ${
                notification.read_at
                  ? "border-border/60 opacity-75"
                  : "border-primary/20"
              }`}
            >
              <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-full ${className}`}
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold">{notification.title}</p>
                  {!notification.read_at ? (
                    <span className="mt-1 size-2 shrink-0 rounded-full bg-sky-500" />
                  ) : null}
                </div>
                {notification.body ? (
                  <p className="mt-0.5 text-xs font-light text-muted-foreground">
                    {notification.body}
                  </p>
                ) : null}
                <p className="mt-1 flex items-center gap-1 text-[10px] font-light text-muted-foreground">
                  <Clock className="size-3" />
                  {new Date(notification.created_at).toLocaleString("en-IN")}
                </p>
              </div>
            </NotificationItem>
          );
        })}
      </div>
    </section>
  );
}

function iconFor(type: string) {
  switch (type) {
    case "application":
    case "application_received":
    case "selection":
      return { Icon: UserPlus, className: "bg-emerald-100 text-emerald-700" };
    case "check_in":
    case "check_out":
      return { Icon: CheckCircle2, className: "bg-primary/15 text-primary" };
    case "payment":
      return { Icon: Wallet, className: "bg-red-100 text-red-600" };
    case "rating":
      return { Icon: Megaphone, className: "bg-amber-100 text-amber-700" };
    default:
      return { Icon: Bell, className: "bg-sky-100 text-sky-700" };
  }
}
