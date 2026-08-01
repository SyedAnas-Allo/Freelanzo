"use client";

import Link from "next/link";
import { ChevronDown, Phone } from "lucide-react";
import { SosBadge } from "@/components/sos-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** expandable SOS strip for active job flows. */
export function SosCallout({ className }: { className?: string }) {
  return (
    <details
      className={cn(
        "group z-20 overflow-hidden rounded-xl border border-red-200/80 bg-background/95 shadow-sm backdrop-blur",
        className,
      )}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5 outline-none transition-colors hover:bg-red-50/70 focus-visible:ring-2 focus-visible:ring-red-400/60 [&::-webkit-details-marker]:hidden">
        <SosBadge size="sm" className="ring-2 ring-red-100" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold tracking-tight text-red-700">
            Emergency SOS
          </p>
          <p className="text-[11px] font-medium text-red-800/70">
            Feel unsafe? Get help immediately.
          </p>
        </div>
        <ChevronDown className="size-4 shrink-0 text-red-600 transition-transform group-open:rotate-180" />
      </summary>
      <div className="grid grid-cols-2 gap-2 border-t border-red-100 bg-red-50/50 p-3">
        <Button
          className="h-11 rounded-xl bg-red-600 text-sm font-bold hover:bg-red-700"
          asChild
        >
          <a href="tel:112">
            <Phone className="size-4" />
            Call 112
          </a>
        </Button>
        <Button
          variant="outline"
          className="h-11 rounded-xl border-red-300 bg-white text-sm font-bold text-red-700 hover:bg-red-50"
          asChild
        >
          <Link href="/safety">Safety help</Link>
        </Button>
      </div>
    </details>
  );
}
