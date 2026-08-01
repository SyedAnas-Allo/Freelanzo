"use client";

import { useState } from "react";
import { useRouter } from "@/hooks/use-app-router";
import { CircleAlert, Flag, LogOut, MoreVertical } from "lucide-react";
import { toast } from "sonner";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";

export function ApplicationActionsMenu({
  applicationId,
  canWithdraw = true,
  report,
}: {
  applicationId: string;
  canWithdraw?: boolean;
  report?: {
    reportedUserId: string;
    reportedName: string;
    jobId: string;
  } | null;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const showReport = !!report?.reportedUserId;
  if (!canWithdraw && !showReport) return null;

  async function withdraw() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("withdraw_application", {
      p_application_id: applicationId,
    });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setConfirmOpen(false);
    toast.success("Application withdrawn");
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
            aria-label="Application options"
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={6}
          className="min-w-56 rounded-xl p-1.5 shadow-lg ring-1 ring-border/60"
        >
          {showReport ? (
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
              Report business
            </DropdownMenuItem>
          ) : null}
          {showReport && canWithdraw ? (
            <DropdownMenuSeparator className="my-1.5" />
          ) : null}
          {canWithdraw ? (
            <DropdownMenuItem
              variant="destructive"
              className="gap-2.5 rounded-lg px-2.5 py-2.5 text-[13px] font-semibold whitespace-nowrap"
              onSelect={(event) => {
                event.preventDefault();
                setConfirmOpen(true);
              }}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <LogOut className="size-3.5" />
              </span>
              Withdraw application
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {showReport && report ? (
        <ReportSheet
          open={reportOpen}
          onOpenChange={setReportOpen}
          direction="freelancer_to_business"
          reportedUserId={report.reportedUserId}
          reportedName={report.reportedName}
          jobId={report.jobId}
          applicationId={applicationId}
        />
      ) : null}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent showCloseButton={!loading}>
          <DialogHeader className="flex-row items-start gap-3 text-left">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <CircleAlert className="size-5" />
            </span>
            <div className="min-w-0 space-y-1.5 pt-0.5">
              <DialogTitle className="text-base font-bold">
                Withdraw application?
              </DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-2 leading-relaxed">
                  <p>
                    Your application will be removed and this time slot will
                    free up.
                  </p>
                  <p>
                    <span className="font-semibold text-foreground">
                      This will lower your reliability score.
                    </span>{" "}
                    Doing this often can get your account suspended.
                  </p>
                </div>
              </DialogDescription>
            </div>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => setConfirmOpen(false)}
            >
              Keep it
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={loading}
              onClick={withdraw}
            >
              {loading ? "Withdrawing…" : "Withdraw"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
