"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  createSupabaseReportsStore,
  reasonRequiresDetails,
  reportReasonsFor,
  submitReport,
  type ReportDirection,
} from "@/lib/reports";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function ReportSheet({
  open,
  onOpenChange,
  direction,
  reportedUserId,
  reportedName,
  jobId,
  applicationId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  direction: ReportDirection;
  reportedUserId: string;
  reportedName: string;
  jobId: string | null;
  applicationId: string | null;
}) {
  const reasons = reportReasonsFor(direction);
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) {
      setReason(null);
      setDetails("");
    }
  }, [open]);

  function submit() {
    if (!reason) {
      toast.error("Pick a reason");
      return;
    }
    if (reasonRequiresDetails(reason) && !details.trim()) {
      toast.error("Please add a short note");
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Sign in to submit a report");
        return;
      }

      const result = await submitReport(createSupabaseReportsStore(supabase), {
        reporterId: user.id,
        reportedUserId,
        jobId,
        applicationId,
        reason,
        details,
      });

      if (!result.ok) {
        if (result.duplicate) {
          toast.message("You've already reported this");
          onOpenChange(false);
          return;
        }
        toast.error(result.message);
        return;
      }

      toast.success("Report submitted. We'll review it.");
      onOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] gap-0 overflow-y-auto rounded-t-3xl pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="pb-2">
          <SheetTitle className="text-left text-lg font-extrabold">
            Report {reportedName}
          </SheetTitle>
          <SheetDescription className="text-left">
            Reports are private. We only use them to keep Freelanzo safe.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-2 px-4 pb-3">
          {reasons.map((item) => {
            const selected = reason === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setReason(item.key)}
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

        <div className="px-4 pb-4">
          <Textarea
            placeholder={
              reasonRequiresDetails(reason ?? "")
                ? "Tell us what happened (required)…"
                : "Optional details…"
            }
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            className="min-h-24"
          />
          <Button
            type="button"
            className="mt-3 w-full"
            disabled={pending || !reason}
            onClick={submit}
          >
            {pending ? "Submitting…" : "Submit report"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
