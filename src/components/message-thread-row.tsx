import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function MessageThreadRow({
  href,
  name,
  preview,
  time,
  unread,
  photoUrl,
  online,
  badge,
  icon,
}: {
  href: string;
  name: string;
  preview: string;
  time: string;
  unread?: number;
  photoUrl?: string | null;
  online?: boolean;
  badge?: string;
  icon?: React.ReactNode;
}) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Link
      href={href}
      className="flex items-center gap-3 border-b border-border/50 px-1 py-3 transition hover:bg-muted/30"
    >
      <div className="relative shrink-0">
        {icon ? (
          <div className="flex size-11 items-center justify-center rounded-full bg-secondary text-primary">
            {icon}
          </div>
        ) : (
          <Avatar className="size-11">
            <AvatarImage src={photoUrl ?? undefined} alt={name} />
            <AvatarFallback className="bg-secondary text-xs font-bold text-primary">
              {initials || "?"}
            </AvatarFallback>
          </Avatar>
        )}
        {online ? (
          <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-card bg-emerald-500" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate text-sm font-bold">{name}</p>
            {badge ? (
              <Badge variant="secondary" size="sm" className="shrink-0">
                {badge}
              </Badge>
            ) : null}
          </div>
          <span className="shrink-0 text-[10px] font-light text-muted-foreground">
            {time}
          </span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p
            className={cn(
              "truncate text-xs font-light text-muted-foreground",
              unread ? "font-medium text-foreground/80" : null,
            )}
          >
            {preview}
          </p>
          {unread && unread > 0 ? (
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
