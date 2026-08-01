import { cn } from "@/lib/utils";

export const formControlClassName =
  "h-auto border-0 bg-transparent p-0 text-[15px] font-bold shadow-none focus-visible:ring-0 dark:bg-transparent";

export const formSelectTriggerClassName =
  "h-auto w-full border-0 bg-transparent p-0 text-[15px] font-bold shadow-none focus-visible:ring-0 dark:bg-transparent";

export function FormField({
  icon: Icon,
  label,
  required,
  hint,
  action,
  children,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  required?: boolean;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-3 px-3.5 py-3", className)}>
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/8 text-primary">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-light text-muted-foreground">
            {label}
            {required ? <span className="text-destructive"> *</span> : null}
          </p>
          {hint ? (
            <p className="text-[10px] font-light text-muted-foreground">
              {hint}
            </p>
          ) : null}
        </div>
        <div className="mt-0.5">{children}</div>
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </div>
  );
}
