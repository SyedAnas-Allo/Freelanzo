import { Check, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function SuccessScreen({
  title,
  description,
  className,
  icon = "check",
}: {
  title: string;
  description?: string;
  className?: string;
  icon?: "check" | "check-circle";
}) {
  const Icon = icon === "check-circle" ? CheckCircle2 : Check;

  return (
    <div className={cn("flex flex-col items-center text-center", className)}>
      <div className="relative flex size-20 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
        <Icon
          aria-hidden="true"
          className="size-10"
          strokeWidth={icon === "check" ? 2.5 : undefined}
        />
        <span className="absolute -right-0.5 top-1.5 size-2 rounded-sm bg-primary" />
        <span className="absolute -left-1.5 bottom-3 size-1.5 rounded-full bg-amber-400" />
        <span className="absolute right-1 bottom-0.5 size-1 rounded-full bg-sky-400" />
      </div>
      <h1 className="mt-5 text-pretty text-2xl font-extrabold tracking-tight">
        {title}
      </h1>
      {description ? (
        <p className="mt-1 text-pretty text-sm font-light text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}
