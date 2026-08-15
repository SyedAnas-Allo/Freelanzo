"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { ScoreHelpContent } from "@/lib/score-help";
import { cn } from "@/lib/utils";

export function InfoHelpSheet({
  open,
  onOpenChange,
  title,
  description,
  metrics,
  footerNote,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  metrics?: { label: string; definition: string }[];
  footerNote?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] gap-0 overflow-hidden rounded-t-3xl p-0 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="border-b border-border/50 px-4 pb-3 pt-4">
          <SheetTitle className="pr-8 text-left text-lg font-extrabold">
            {title}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Explanation of how this score is calculated
          </SheetDescription>
        </SheetHeader>

        <div className="overflow-y-auto overscroll-contain px-4 py-4 pb-6">
          <p className="text-[13px] font-light leading-relaxed text-muted-foreground">
            {description}
          </p>

          {metrics && metrics.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {metrics.map((m) => (
                <li key={m.label}>
                  <p className="text-xs font-bold text-foreground">{m.label}</p>
                  <p className="mt-0.5 text-[12px] font-light leading-relaxed text-muted-foreground">
                    {m.definition}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}

          {footerNote ? (
            <p className="mt-4 text-[11px] font-medium leading-relaxed text-muted-foreground/90">
              {footerNote}
            </p>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Score section header with Info + “How it works?” opening a bottom sheet. */
export function ScoreHelpHeader({
  heading,
  help,
  className,
}: {
  heading: string;
  help: ScoreHelpContent;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const openHelp = () => setOpen(true);

  return (
    <>
      <div className={cn("mb-3 flex items-center justify-between", className)}>
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-extrabold">{heading}</h2>
        </div>
        <button
          type="button"
          onClick={openHelp}
          className="text-[11px] font-bold text-primary transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          How it works?
        </button>
      </div>

      <InfoHelpSheet
        open={open}
        onOpenChange={setOpen}
        title={help.sheetTitle}
        description={help.description}
        metrics={help.metrics}
        footerNote={help.footerNote}
      />
    </>
  );
}
