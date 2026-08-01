import { BadgeCheck, Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function StarRow({
  value,
  size = "sm",
  className,
}: {
  value: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const dim = size === "md" ? "size-4" : "size-3.5";
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            dim,
            i < Math.round(value)
              ? "fill-amber-400 text-amber-400"
              : "fill-muted text-muted",
          )}
        />
      ))}
    </div>
  );
}

export function ReviewListItem({
  name,
  photoUrl,
  role,
  rating,
  date,
  comment,
  verified,
}: {
  name: string;
  photoUrl?: string | null;
  role?: string | null;
  rating: number;
  date: string;
  comment?: string | null;
  verified?: boolean;
}) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <article className="flex gap-3 border-b border-border/50 py-3 last:border-0">
      <Avatar className="size-10 shrink-0">
        <AvatarImage src={photoUrl ?? undefined} alt={name} />
        <AvatarFallback className="bg-secondary text-xs font-bold text-primary">
          {initials || "?"}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="flex items-center gap-1 text-sm font-bold">
              {name}
              {verified ? (
                <BadgeCheck className="size-3.5 fill-sky-500 text-white" />
              ) : null}
            </p>
            {role ? (
              <p className="text-[11px] font-light text-muted-foreground">
                {role}
              </p>
            ) : null}
          </div>
          <p className="shrink-0 text-[10px] font-light text-muted-foreground">
            {date}
          </p>
        </div>
        <StarRow value={rating} className="mt-1" />
        {comment ? (
          <p className="mt-1.5 text-xs font-light leading-relaxed text-muted-foreground">
            {comment}
          </p>
        ) : null}
      </div>
    </article>
  );
}
