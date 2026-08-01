"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { BinaryChoice } from "@/components/actions/binary-choice";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function WorkerPayRow({
  name,
  role,
  photoUrl,
  paid,
  onToggle,
  disabled,
}: {
  name: string;
  role?: string | null;
  photoUrl?: string | null;
  paid: boolean | null;
  onToggle?: (paid: boolean) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const showChoices = onToggle && (paid === null || editing);

  function choose(next: boolean) {
    setEditing(false);
    onToggle?.(next);
  }

  return (
    <div className="py-3.5">
      <div className="flex items-center gap-3">
        <Avatar className="size-10">
          <AvatarImage src={photoUrl ?? undefined} alt={name} />
          <AvatarFallback className="bg-secondary text-xs font-bold text-primary">
            {initials || "?"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{name}</p>
          {role ? (
            <p className="truncate text-xs font-light text-muted-foreground">
              {role}
            </p>
          ) : null}
        </div>
        {paid !== null && !editing ? (
          <div className="flex shrink-0 items-center gap-1">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold",
                paid
                  ? "bg-emerald-500/10 text-emerald-700"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {paid ? <Check className="size-3.5" strokeWidth={3} /> : null}
              {paid ? "Paid" : "Not paid"}
            </span>
            {onToggle ? (
              <button
                type="button"
                disabled={disabled}
                onClick={() => setEditing(true)}
                className="rounded-md p-2 text-xs font-semibold text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
              >
                Change
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {showChoices ? (
        <BinaryChoice
          className="mt-3"
          positiveLabel="Paid"
          negativeLabel="Not paid"
          disabled={disabled}
          showIcons={false}
          onPositive={() => choose(true)}
          onNegative={() => choose(false)}
        />
      ) : null}
    </div>
  );
}
