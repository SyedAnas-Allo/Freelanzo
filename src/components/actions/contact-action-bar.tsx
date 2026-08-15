"use client";

import Link from "next/link";
import { MessageSquare, Phone } from "lucide-react";
import { DialLink } from "@/components/dial-link";
import { cn } from "@/lib/utils";

export function ContactActionBar({
  phone,
  chatHref,
  callLocked = false,
  showChat = true,
  layout = "row",
  size = "md",
  className,
}: {
  phone?: string | null;
  /** Job group chat route, e.g. `/messages/{jobId}`. */
  chatHref: string;
  /** Same window as closed gig chat — Call stays visible but disabled. */
  callLocked?: boolean;
  /** Keep chat hidden when only pre-selection calling is allowed. */
  showChat?: boolean;
  layout?: "row" | "stack";
  size?: "sm" | "md";
  className?: string;
}) {
  const stacked = layout === "stack";
  const compact = size === "sm";
  const canCall = Boolean(phone) && !callLocked;

  const baseClass = cn(
    "flex flex-1 items-center justify-center rounded-xl",
    stacked ? "flex-col gap-1 py-2.5" : "gap-1.5 py-2.5",
    compact ? "text-[12px] font-bold" : "text-sm font-semibold",
  );

  const callButton = canCall ? (
    <DialLink
      phone={phone!}
      className={cn(
        baseClass,
        stacked ? "bg-primary/5 text-primary" : "bg-primary/10 text-primary",
      )}
    >
      <Phone
        aria-hidden="true"
        className={cn(compact ? "size-3.5" : stacked ? "size-4.5" : "size-4")}
      />
      <span className={stacked ? "text-[11px] font-bold" : undefined}>Call</span>
    </DialLink>
  ) : phone || callLocked || stacked ? (
    <div
      className={cn(baseClass, "bg-muted/50 text-muted-foreground opacity-50")}
      aria-disabled="true"
      title={
        callLocked
          ? "Number locked after gig ended"
          : "Phone number unavailable"
      }
    >
      <Phone
        aria-hidden="true"
        className={cn(compact ? "size-3.5" : stacked ? "size-4.5" : "size-4")}
      />
      <span className={stacked ? "text-[11px] font-bold" : undefined}>Call</span>
    </div>
  ) : null;

  return (
    <div className={cn(stacked ? "grid grid-cols-2 gap-2" : "flex gap-2", className)}>
      {callButton}

      {showChat ? (
        <Link
          href={chatHref}
          className={cn(
            baseClass,
            stacked ? "bg-sky-50 text-sky-700" : "bg-sky-500/10 text-sky-700",
          )}
        >
          <MessageSquare
            aria-hidden="true"
            className={cn(compact ? "size-3.5" : stacked ? "size-4.5" : "size-4")}
          />
          <span className={stacked ? "text-[11px] font-bold" : undefined}>
            Chat
          </span>
        </Link>
      ) : null}
    </div>
  );
}
