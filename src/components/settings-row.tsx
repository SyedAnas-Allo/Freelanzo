import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function SettingsGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border/50 bg-card divide-y divide-border/40",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SettingsRow({
  href,
  icon,
  label,
  description,
  pill,
  pillVariant = "secondary",
  danger,
  bareIcon,
  onClick,
}: {
  href?: string;
  icon: React.ReactNode;
  label: string;
  description?: string;
  pill?: string;
  pillVariant?:
    | "secondary"
    | "success"
    | "default"
    | "destructive"
    | "outline"
    | "info"
    | "warning";
  danger?: boolean;
  /** Skip the circular icon chrome (e.g. custom SOS badge). */
  bareIcon?: boolean;
  onClick?: () => void;
}) {
  const inner = (
    <>
      {bareIcon ? (
        <span className="shrink-0">{icon}</span>
      ) : (
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full",
            danger ? "bg-red-500/10 text-red-600" : "bg-primary/8 text-primary",
          )}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-sm font-semibold",
            danger ? "text-red-700" : "text-foreground",
          )}
        >
          {label}
        </span>
        {description ? (
          <span
            className={cn(
              "mt-0.5 block text-[11px] font-light",
              danger ? "text-red-600/70" : "text-muted-foreground",
            )}
          >
            {description}
          </span>
        ) : null}
      </span>
      {pill ? (
        <Badge variant={pillVariant} size="sm" className="shrink-0">
          {pill}
        </Badge>
      ) : null}
      <ChevronRight
        className={cn(
          "size-4 shrink-0",
          danger ? "text-red-400" : "text-muted-foreground/70",
        )}
      />
    </>
  );

  const className = cn(
    "flex w-full items-center gap-3 px-3.5 py-3.5 text-left transition",
    danger ? "bg-red-50/70 hover:bg-red-50" : "hover:bg-muted/40",
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  );
}
