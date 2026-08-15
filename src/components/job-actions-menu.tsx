"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "@/hooks/use-app-router";
import { CircleAlert, MoreVertical, Pencil, XCircle } from "lucide-react";
import { toast } from "sonner";
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
import { createClient } from "@/lib/supabase/client";

export function JobActionsMenu({
  jobId,
  canEdit = true,
}: {
  jobId: string;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function cancelJob() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("cancel_job", {
      p_job_id: jobId,
    });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setConfirmOpen(false);
    toast.success("Gig cancelled");
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
            aria-label="Gig options"
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={6}
          className="min-w-56 rounded-xl p-1.5 shadow-lg ring-1 ring-border/60"
        >
          {canEdit ? (
            <DropdownMenuItem
              className="gap-2.5 rounded-lg px-2.5 py-2.5 text-[13px] font-semibold whitespace-nowrap"
              asChild
            >
              <Link href={`/business/jobs/${jobId}/edit`}>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Pencil className="size-3.5" />
                </span>
                Edit gig
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            variant="destructive"
            className="gap-2.5 rounded-lg px-2.5 py-2.5 text-[13px] font-semibold whitespace-nowrap"
            onSelect={(event) => {
              event.preventDefault();
              setConfirmOpen(true);
            }}
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <XCircle className="size-3.5" />
            </span>
            Cancel gig
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent showCloseButton={!loading}>
          <DialogHeader className="flex-row items-start gap-3 text-left">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <CircleAlert className="size-5" />
            </span>
            <div className="min-w-0 space-y-1.5 pt-0.5">
              <DialogTitle className="text-base font-bold">
                Cancel this gig?
              </DialogTitle>
              <DialogDescription className="leading-relaxed">
                This gig will close. Applicants will be notified and can no
                longer continue on it.
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
              onClick={cancelJob}
            >
              {loading ? "Cancelling…" : "Cancel gig"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
