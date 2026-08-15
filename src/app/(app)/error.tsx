"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, Home, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-route-error]", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50dvh] max-w-md flex-col items-center justify-center px-4 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="size-6" aria-hidden />
      </div>
      <h1 className="mt-4 text-lg font-bold">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This screen hit an unexpected error. You can try again or go home.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button type="button" onClick={reset}>
          <RefreshCw data-icon="inline-start" />
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/">
            <Home data-icon="inline-start" />
            Home
          </Link>
        </Button>
      </div>
    </div>
  );
}
