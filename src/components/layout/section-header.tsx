import Link from "next/link";
import { cn } from "@/lib/utils";

export function SectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: { label: string; href: string } | React.ReactNode;
  className?: string;
}) {
  const actionNode =
    action &&
    typeof action === "object" &&
    "label" in action &&
    "href" in action ? (
      <Link
        href={action.href}
        className="shrink-0 text-sm font-semibold text-primary hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {action.label}
      </Link>
    ) : (
      action
    );

  return (
    <div
      className={cn(
        "flex min-w-0 items-center justify-between gap-3",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-pretty text-base font-extrabold">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actionNode}
    </div>
  );
}
