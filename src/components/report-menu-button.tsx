"use client";

import { useState } from "react";
import { FileText, Flag, MoreVertical, X } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/hooks/use-app-router";
import { ReportSheet } from "@/components/report-sheet";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import type { ReportDirection } from "@/lib/reports";
import {
  REJECTION_REASON_OPTIONS,
  rejectionReasonRequiresDetails,
  resolveRejectionReason,
} from "@/lib/rejection-reasons";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { ApplicationStatus } from "@/types/database";

export function ReportMenuButton({
  direction,
  reportedUserId,
  reportedName,
  jobId,
  applicationId,
  align = "end",
  rejectionReason,
  applicationStatus,
  onApplicationChanged,
}: {
  direction: ReportDirection;
  reportedUserId: string;
  reportedName: string;
  jobId: string | null;
  applicationId: string | null;
  align?: "start" | "end" | "center";
  rejectionReason?: string | null;
  applicationStatus?: ApplicationStatus;
  onApplicationChanged?: () => void;
}) {
  const router = useRouter();
  const [reportOpen, setReportOpen] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReasonKey, setRejectReasonKey] = useState<string | null>(null);
  const [rejectDetails, setRejectDetails] = useState("");
  const [rejecting, setRejecting] = useState(false);

  function resetRejectForm() {
    setRejectReasonKey(null);
    setRejectDetails("");
  }

  async function rejectSelectedFreelancer() {
    if (!applicationId || !jobId) return;

    if (!rejectReasonKey) {
      toast.error("Pick a reason");
      return;
    }
    if (
      rejectionReasonRequiresDetails(rejectReasonKey) &&
      !rejectDetails.trim()
    ) {
      toast.error("Please add a short note");
      return;
    }

    const reason = resolveRejectionReason(rejectReasonKey, rejectDetails);
    if (!reason) return;

    setRejecting(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("set_application_status", {
      p_application_id: applicationId,
      p_status: "rejected",
      p_rejection_reason: reason,
    });

    if (!error) {
      await supabase.rpc("create_notification", {
        p_user_id: reportedUserId,
        p_type: "selection",
        p_title: "Application declined",
        p_body: "Open My Gigs for details.",
        p_meta: { job_id: jobId, status: "rejected" },
      });
    }

    setRejecting(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    setRejectOpen(false);
    resetRejectForm();
    toast.success("Freelancer rejected");
    onApplicationChanged?.();
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Options for ${reportedName}`}
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={align}
          sideOffset={6}
          className="min-w-48 rounded-xl p-1.5 shadow-lg ring-1 ring-border/60"
        >
          {applicationStatus === "accepted" ? (
            <DropdownMenuItem
              className="gap-2.5 rounded-lg px-2.5 py-2.5 text-[13px] font-semibold text-destructive focus:text-destructive"
              onSelect={(event) => {
                event.preventDefault();
                setRejectOpen(true);
              }}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                <X className="size-3.5" />
              </span>
              Reject freelancer
            </DropdownMenuItem>
          ) : null}
          {rejectionReason ? (
            <DropdownMenuItem
              className="gap-2.5 rounded-lg px-2.5 py-2.5 text-[13px] font-semibold"
              onSelect={(event) => {
                event.preventDefault();
                setReasonOpen(true);
              }}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                <FileText className="size-3.5" />
              </span>
              View rejection reason
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            className="gap-2.5 rounded-lg px-2.5 py-2.5 text-[13px] font-semibold"
            onSelect={(event) => {
              event.preventDefault();
              setReportOpen(true);
            }}
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Flag className="size-3.5" />
            </span>
            Report
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ReportSheet
        open={reportOpen}
        onOpenChange={setReportOpen}
        direction={direction}
        reportedUserId={reportedUserId}
        reportedName={reportedName}
        jobId={jobId}
        applicationId={applicationId}
      />

      <Dialog open={reasonOpen} onOpenChange={setReasonOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejection reason</DialogTitle>
            <DialogDescription>
              The reason recorded when this freelancer was removed from the
              selected list.
            </DialogDescription>
          </DialogHeader>
          <p className="whitespace-pre-wrap rounded-lg bg-muted/60 p-3 text-sm leading-relaxed">
            {rejectionReason}
          </p>
        </DialogContent>
      </Dialog>

      <Dialog
        open={rejectOpen}
        onOpenChange={(open) => {
          if (rejecting) return;
          if (!open) resetRejectForm();
          setRejectOpen(open);
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject {reportedName}?</DialogTitle>
            <DialogDescription>
              Choose why you&apos;re removing them from the selected list. You
              can view this later from the three-dot menu.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {REJECTION_REASON_OPTIONS.map((item) => {
              const selected = rejectReasonKey === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  disabled={rejecting}
                  onClick={() => setRejectReasonKey(item.key)}
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
          {rejectionReasonRequiresDetails(rejectReasonKey) ? (
            <div>
              <Textarea
                value={rejectDetails}
                onChange={(event) => setRejectDetails(event.target.value)}
                placeholder="Tell us a bit more (required)…"
                maxLength={500}
                rows={3}
                disabled={rejecting}
                autoFocus
              />
              <p className="mt-1 text-right text-xs text-muted-foreground">
                {rejectDetails.length}/500
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={rejecting}
              onClick={() => {
                resetRejectForm();
                setRejectOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                rejecting ||
                !rejectReasonKey ||
                (rejectionReasonRequiresDetails(rejectReasonKey) &&
                  !rejectDetails.trim())
              }
              onClick={() => void rejectSelectedFreelancer()}
            >
              {rejecting ? "Rejecting..." : "Reject freelancer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
