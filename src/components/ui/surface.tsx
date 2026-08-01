import { cn } from "@/lib/utils";

export function Surface({
  children,
  className,
  as: Component = "section",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  return (
    <Component
      className={cn(
        "rounded-xl border border-border/70 bg-card p-4 shadow-sm",
        className,
      )}
    >
      {children}
    </Component>
  );
}
