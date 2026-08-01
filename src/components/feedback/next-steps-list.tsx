import { cn } from "@/lib/utils";

export type NextStep = {
  icon: React.ComponentType<{ className?: string }>;
  title?: string;
  body: string;
};

export function NextStepsList({
  title = "What happens next?",
  steps,
  className,
}: {
  title?: string;
  steps: NextStep[];
  className?: string;
}) {
  return (
    <div className={cn(className)}>
      <h2 className="text-sm font-extrabold">{title}</h2>
      <ul className="mt-3 divide-y divide-border/60 rounded-lg border border-border/70 bg-card">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <li
              key={step.title ?? step.body}
              className="flex items-start gap-3 p-3.5"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                <Icon aria-hidden="true" className="size-4" />
              </span>
              {step.title ? (
                <div>
                  <p className="text-sm font-bold">{step.title}</p>
                  <p className="text-xs font-light text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              ) : (
                <p className="pt-1.5 text-sm font-light text-muted-foreground">
                  {step.body}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
