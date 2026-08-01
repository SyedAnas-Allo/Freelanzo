import { cn } from "@/lib/utils";

export function FormGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/50 bg-card",
        className,
      )}
    >
      {children}
    </div>
  );
}
