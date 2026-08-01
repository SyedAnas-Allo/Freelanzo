import Link from "next/link";
import { cn } from "@/lib/utils";

export type FilterChip = {
  key: string;
  label: string;
  href: string;
};

export function FilterChipRow({
  chips,
  activeKey,
  className,
}: {
  chips: FilterChip[];
  activeKey: string;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-2 overflow-x-auto hide-scrollbar", className)}>
      {chips.map((chip) => {
        const active = chip.key === activeKey;
        return (
          <Link
            key={chip.key}
            href={chip.href}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition",
              active
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                : "border border-border/80 bg-card text-muted-foreground hover:bg-muted/40",
            )}
          >
            {chip.label}
          </Link>
        );
      })}
    </div>
  );
}
