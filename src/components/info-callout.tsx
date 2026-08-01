import { cn } from "@/lib/utils";

export function InfoCallout({
  title,
  children,
  icon,
  className,
  variant = "default",
}: {
  title: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  variant?: "default" | "important";
}) {
  const important = variant === "important";

  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        important
          ? "border-red-200/80 bg-gradient-to-br from-red-50 via-rose-50/80 to-white shadow-[0_8px_24px_rgba(220,38,38,0.08)] dark:border-red-900/60 dark:from-red-950/50 dark:via-rose-950/30 dark:to-background"
          : "border-primary/15 bg-primary/[0.06]",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {icon ? (
          <span
            className={cn(
              "flex shrink-0 items-center justify-center",
              important
                ? "size-9 rounded-full bg-red-100 text-red-700 ring-4 ring-red-50 dark:bg-red-950 dark:text-red-300 dark:ring-red-950/50"
                : "text-primary",
            )}
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <p
            className={cn(
              "text-sm font-bold",
              important
                ? "text-red-800 dark:text-red-200"
                : "text-foreground",
            )}
          >
            {title}
          </p>
          <div
            className={cn(
              "mt-1.5 text-xs leading-relaxed",
              important
                ? "font-medium text-red-950/70 dark:text-red-100/70"
                : "font-light text-muted-foreground",
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
