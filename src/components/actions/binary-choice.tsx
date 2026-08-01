"use client";

import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const positiveClassName =
  "border-emerald-300 bg-emerald-50 font-bold text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300";
const negativeClassName =
  "border-border bg-background font-bold text-muted-foreground hover:bg-muted";
const rejectClassName =
  "border-red-200 bg-red-50 font-bold text-red-600 hover:bg-red-100 hover:text-red-700";

export function BinaryChoice({
  positiveLabel,
  negativeLabel,
  onPositive,
  onNegative,
  disabled,
  positiveDisabled,
  negativeDisabled,
  className,
  negativeTone = "muted",
  showIcons = true,
}: {
  positiveLabel: string;
  negativeLabel: string;
  onPositive: () => void;
  onNegative: () => void;
  disabled?: boolean;
  positiveDisabled?: boolean;
  negativeDisabled?: boolean;
  className?: string;
  negativeTone?: "muted" | "reject";
  showIcons?: boolean;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-2", className)}>
      <Button
        type="button"
        variant="outline"
        className={cn(
          negativeTone === "reject" ? rejectClassName : negativeClassName,
        )}
        disabled={disabled || negativeDisabled}
        onClick={onNegative}
      >
        {showIcons ? <X className="size-4" strokeWidth={2.5} /> : null}
        {negativeLabel}
      </Button>
      <Button
        type="button"
        variant="outline"
        className={positiveClassName}
        disabled={disabled || positiveDisabled}
        onClick={onPositive}
      >
        {showIcons ? <Check className="size-4" strokeWidth={2.5} /> : null}
        {positiveLabel}
      </Button>
    </div>
  );
}

export const binaryChoiceClassNames = {
  positive: positiveClassName,
  negative: negativeClassName,
  reject: rejectClassName,
};
