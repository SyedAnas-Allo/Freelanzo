import { PageBack } from "@/components/page-back";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  action,
  backHref,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** Hierarchical parent route for the shared back control. */
  backHref?: string;
  className?: string;
}) {
  return (
    <>
      {backHref ? <PageBack href={backHref} /> : null}
      <header
        className={cn(
          "flex min-w-0 items-start justify-between gap-3",
          className,
        )}
      >
        <div className="min-w-0">
          <h1 className="text-pretty text-xl font-extrabold tracking-tight">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 text-pretty text-sm font-light text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
    </>
  );
}
