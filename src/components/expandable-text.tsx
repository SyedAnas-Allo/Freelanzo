"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function ExpandableText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const long = text.length > 140;

  return (
    <div>
      <p
        className={cn(
          "text-[13px] font-medium leading-relaxed text-muted-foreground",
          !open && long && "line-clamp-3",
          className,
        )}
      >
        {text}
      </p>
      {long ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-1 inline-flex items-center gap-0.5 text-xs font-bold text-primary"
        >
          {open ? "Read Less" : "Read More"}
          <ChevronDown
            className={cn("size-4 transition-transform", open && "rotate-180")}
          />
        </button>
      ) : null}
    </div>
  );
}
