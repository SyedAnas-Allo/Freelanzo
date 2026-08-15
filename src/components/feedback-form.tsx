"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { StarRow } from "@/components/review-list-item";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  FEEDBACK_CATEGORIES,
  categoryLabel,
  createSupabaseAppFeedbackStore,
  feedbackCommentRequired,
  submitAppFeedback,
} from "@/lib/app-feedback";
import {
  ensureOnlineForMutation,
  flashSuccess,
  flashValidation,
  presentAppError,
} from "@/lib/flash-message";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { AppFeedback, AppFeedbackCategory } from "@/types/database";

function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => {
        const n = i + 1;
        return (
          <button
            key={n}
            type="button"
            aria-label={`${n} stars`}
            onClick={() => onChange(n)}
            className="p-0.5"
          >
            <Star
              className={cn(
                "size-8",
                n <= value
                  ? "fill-amber-400 text-amber-400"
                  : "fill-muted text-muted",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

export function FeedbackForm({
  initialRecent = [],
}: {
  initialRecent?: AppFeedback[];
}) {
  const [overall, setOverall] = useState(0);
  const [category, setCategory] = useState<AppFeedbackCategory | null>(null);
  const [comment, setComment] = useState("");
  const [recent, setRecent] = useState(initialRecent);
  const [pending, startTransition] = useTransition();

  const commentRequired = feedbackCommentRequired(overall);

  function submit() {
    if (!overall) {
      flashValidation("Pick a star rating");
      return;
    }
    if (!category) {
      flashValidation("Pick a category");
      return;
    }
    if (commentRequired && !comment.trim()) {
      flashValidation("Please add a short note for low ratings");
      return;
    }
    if (!ensureOnlineForMutation()) return;

    startTransition(async () => {
      const supabase = createClient();
      const result = await submitAppFeedback(
        createSupabaseAppFeedbackStore(supabase),
        {
          overall,
          category,
          comment,
        },
      );

      if (!result.ok) {
        presentAppError(result.message, { onRetry: () => submit() });
        return;
      }

      flashSuccess("Thanks — we got your feedback");
      setOverall(0);
      setCategory(null);
      setComment("");
      setRecent((prev) => [result.data, ...prev].slice(0, 3));
    });
  }

  return (
    <div className="space-y-5">
      <p className="text-sm font-light text-muted-foreground">
        This rates Freelanzo the app — not a person you worked with.
      </p>

      <div>
        <Label className="text-sm font-bold">How is Freelanzo?</Label>
        <div className="mt-2">
          <StarPicker value={overall} onChange={setOverall} />
        </div>
      </div>

      <div>
        <Label className="text-sm font-bold">What is this about?</Label>
        <div className="mt-2 space-y-2">
          {FEEDBACK_CATEGORIES.map((item) => {
            const selected = category === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setCategory(item.key)}
                className={cn(
                  "flex w-full items-center rounded-xl border px-3.5 py-3 text-left text-sm font-semibold transition-colors",
                  selected
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border/70 bg-card text-foreground hover:bg-muted/40",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label className="text-sm font-bold">
          {commentRequired ? "Tell us more (required)" : "Tell us more (optional)"}
        </Label>
        <Textarea
          placeholder={
            commentRequired
              ? "What went wrong?"
              : "Ideas, bugs, or anything else…"
          }
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="mt-2 min-h-28"
        />
      </div>

      <Button
        type="button"
        className="h-12 w-full rounded-xl font-bold"
        disabled={pending || !overall || !category}
        onClick={submit}
      >
        {pending ? "Sending…" : "Send feedback"}
      </Button>

      {recent.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">
            Your recent feedback
          </p>
          <ul className="divide-y divide-border/50 rounded-xl border border-border/70 bg-card">
            {recent.map((row) => (
              <li key={row.id} className="px-3.5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <StarRow value={Number(row.overall)} />
                  <span className="text-[10px] font-light text-muted-foreground">
                    {new Date(row.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
                <p className="mt-1 text-xs font-semibold">
                  {categoryLabel(row.category)}
                </p>
                {row.comment ? (
                  <p className="mt-0.5 text-xs font-light text-muted-foreground">
                    {row.comment}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
