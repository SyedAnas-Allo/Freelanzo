"use client";

import { useEffect, useRef } from "react";
import { WifiOff } from "lucide-react";
import { flashBackOnline } from "@/lib/flash-message";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { cn } from "@/lib/utils";

/**
 * Persistent offline strip + short "Back online" flash after reconnect.
 * Mount once in the root layout.
 */
export function NetworkStatusCard({ className }: { className?: string }) {
  const { isOnline, wasOffline, hydrated } = useNetworkStatus();
  const hadOffline = useRef(false);

  useEffect(() => {
    if (!hydrated) return;
    if (!isOnline) {
      hadOffline.current = true;
      return;
    }
    if (hadOffline.current || wasOffline) {
      hadOffline.current = false;
      flashBackOnline();
    }
  }, [hydrated, isOnline, wasOffline]);

  if (!hydrated || isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "safe-top sticky top-0 z-[60] border-b border-amber-200/90 bg-amber-50 px-3 pb-2 text-amber-950 shadow-sm dark:border-amber-900/70 dark:bg-amber-950/90 dark:text-amber-50",
        className,
      )}
    >
      <div className="mx-auto flex max-w-lg items-center gap-2 text-xs font-semibold">
        <WifiOff className="size-4 shrink-0" aria-hidden />
        <p>
          You&apos;re offline. Some actions are paused until you reconnect.
        </p>
      </div>
    </div>
  );
}
