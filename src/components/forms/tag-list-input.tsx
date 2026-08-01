"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";

export function TagListInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  function addDraft() {
    const additions = draft
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (additions.length === 0) return;

    const seen = new Set(value.map((item) => item.toLocaleLowerCase()));
    const next = [...value];
    for (const item of additions) {
      const normalized = item.toLocaleLowerCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        next.push(item);
      }
    }
    onChange(next);
    setDraft("");
  }

  function removeTag(index: number) {
    onChange(value.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {value.map((item, index) => (
        <span
          key={`${item}-${index}`}
          className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 py-1 pr-1 pl-2.5 text-xs font-semibold"
        >
          {item}
          <button
            type="button"
            onClick={() => removeTag(index)}
            aria-label={`Remove ${item}`}
            className="flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <Input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={addDraft}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            addDraft();
          } else if (event.key === "Backspace" && !draft && value.length > 0) {
            removeTag(value.length - 1);
          }
        }}
        placeholder={value.length === 0 ? placeholder : "Add another…"}
        aria-label="Add skill"
        className="h-7 min-w-32 flex-1 border-0 bg-transparent p-0 text-sm font-bold shadow-none focus-visible:ring-0"
      />
    </div>
  );
}
