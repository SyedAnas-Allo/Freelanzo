"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ensureOnlineForMutation,
  flashSuccess,
  presentAppError,
} from "@/lib/flash-message";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

function isDuplicateSaveError(error: { code?: string } | null) {
  return error?.code === "23505";
}

export function SaveJobButton({
  jobId,
  userId,
  initialSaved,
  className,
  onSavedChange,
}: {
  jobId: string;
  userId: string;
  initialSaved: boolean;
  className?: string;
  onSavedChange?: (saved: boolean) => void;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [saving, setSaving] = useState(false);

  async function toggleSaved() {
    if (saving) return;
    if (!ensureOnlineForMutation()) return;

    const nextSaved = !saved;
    setSaved(nextSaved);
    setSaving(true);

    const supabase = createClient();
    const { error } = nextSaved
      ? await supabase
          .from("saved_jobs")
          .insert({ freelancer_id: userId, job_id: jobId })
      : await supabase
          .from("saved_jobs")
          .delete()
          .eq("freelancer_id", userId)
          .eq("job_id", jobId);

    setSaving(false);

    if (error && !(nextSaved && isDuplicateSaveError(error))) {
      setSaved(!nextSaved);
      presentAppError(error, { op: "save gig" });
      return;
    }

    onSavedChange?.(nextSaved);
    flashSuccess(nextSaved ? "Gig saved" : "Gig removed from saved");
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn(
        "bg-card/95 text-muted-foreground shadow-sm",
        saved && "text-rose-600",
        className,
      )}
      aria-label={saved ? "Remove gig from saved" : "Save gig"}
      aria-pressed={saved}
      disabled={saving}
      onClick={toggleSaved}
    >
      <Heart className={cn("size-4", saved && "fill-current")} />
    </Button>
  );
}
