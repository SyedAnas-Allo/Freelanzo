import { cn } from "@/lib/utils";

export type StepperItem = {
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
};

export function NumberedStepper({
  steps,
  className,
}: {
  steps: StepperItem[];
  className?: string;
}) {
  return (
    <ol className={cn("space-y-5", className)}>
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {i + 1}
            </span>
            {i < steps.length - 1 ? (
              <span className="mt-1 w-px flex-1 bg-primary/25" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold">{step.title}</p>
              {step.icon ? (
                <span className="shrink-0 text-primary">{step.icon}</span>
              ) : null}
            </div>
            {step.description ? (
              <div className="mt-2">{step.description}</div>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
