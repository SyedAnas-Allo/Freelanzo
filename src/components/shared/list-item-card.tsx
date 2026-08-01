import Link from "next/link";
import { cn } from "@/lib/utils";

type ListItemCardProps = {
  leading?: React.ReactNode;
  title: React.ReactNode;
  badge?: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
  href?: string;
  className?: string;
};

export function ListItemCard({
  leading,
  title,
  badge,
  description,
  meta,
  trailing,
  href,
  className,
}: ListItemCardProps) {
  const content = (
    <>
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <h3 className="truncate text-sm font-bold leading-snug text-foreground">
                {title}
              </h3>
              {badge}
            </div>
            {description ? (
              <div className="mt-0.5 truncate text-xs font-medium text-muted-foreground">
                {description}
              </div>
            ) : null}
            {meta ? (
              <div className="mt-1 truncate text-[11px] font-medium text-muted-foreground">
                {meta}
              </div>
            ) : null}
          </div>
          {trailing ? <div className="shrink-0 text-right">{trailing}</div> : null}
        </div>
      </div>
    </>
  );

  const classes = cn(
    "flex w-full items-center gap-3 rounded-xl border border-border/70 bg-card p-3.5 text-left shadow-sm",
    href &&
      "transition-colors hover:border-primary/25 hover:bg-muted/20 active:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
    className,
  );

  return href ? (
    <Link href={href} className={classes}>
      {content}
    </Link>
  ) : (
    <div className={classes}>{content}</div>
  );
}
