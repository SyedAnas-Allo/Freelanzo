"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Inline recovery card for failed page loads — distinct from EmptyState.
 */
export function LoadErrorCard({
  title = "Couldn't load this page",
  description = "Check your connection and try again.",
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-8 text-center",
        className,
      )}
    >
      <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="size-5" aria-hidden />
      </div>
      <p className="mt-3 text-sm font-bold">{title}</p>
      <p className="mt-1 text-xs font-medium text-muted-foreground">
        {description}
      </p>
      {onRetry ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-4"
          onClick={onRetry}
        >
          <RefreshCw data-icon="inline-start" />
          Retry
        </Button>
      ) : null}
    </div>
  );
}
