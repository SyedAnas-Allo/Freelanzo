import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; href: string };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-border/80 px-4 py-10 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
      ) : null}
      <p className={cn("text-sm font-bold", icon && "mt-2")}>{title}</p>
      {description ? (
        <p className="mt-1 text-xs font-medium text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? (
        <Button asChild className="mt-4" size="sm">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      ) : null}
    </div>
  );
}
