import Link from "next/link";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon,
  href,
  hint,
  tone = "surface",
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  href?: string;
  hint?: React.ReactNode;
  tone?: "surface" | "brand";
  className?: string;
}) {
  const content = (
    <>
      {icon ? <div className="mb-2 opacity-80">{icon}</div> : null}
      <p
        className={cn(
          "font-extrabold leading-none tabular-nums",
          tone === "brand" ? "text-2xl" : "text-sm text-emerald-600",
        )}
      >
        {value}
      </p>
      <p
        className={cn(
          "mt-1 text-[11px]",
          tone === "brand"
            ? "font-medium text-primary-foreground/90"
            : "text-muted-foreground",
        )}
      >
        {label}
      </p>
      {hint ? (
        <div
          className={cn(
            "mt-2 text-[10px] font-medium",
            tone === "brand"
              ? "text-primary-foreground/75"
              : "text-muted-foreground",
          )}
        >
          {hint}
        </div>
      ) : null}
    </>
  );

  const classes = cn(
    "rounded-xl p-3 text-left",
    tone === "brand"
      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
      : "border border-border/70 bg-card text-center",
    href &&
      "transition-colors hover:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
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
