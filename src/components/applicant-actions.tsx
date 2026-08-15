"use client";

import { useState } from "react";
import { useRouter } from "@/hooks/use-app-router";
import { Check } from "lucide-react";
import {
  BinaryChoice,
  binaryChoiceClassNames,
} from "@/components/actions/binary-choice";
import { Button } from "@/components/ui/button";
import {
  ensureOnlineForMutation,
  flashSuccess,
  flashValidation,
  presentAppError,
} from "@/lib/flash-message";
import { isSelectionOpen } from "@/lib/status";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { ApplicationStatus, JobStatus } from "@/types/database";

export function ApplicantActions({
  applicationId,
  jobId,
  jobStatus,
  currentStatus,
  headcount,
  acceptedCount,
  onApplicationChanged,
}: {
  applicationId: string;
  jobId: string;
  jobStatus: JobStatus;
  currentStatus: ApplicationStatus;
  headcount: number;
  acceptedCount: number;
  onApplicationChanged?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function setStatus(status: "accepted" | "rejected") {
    if (status === "accepted" && acceptedCount >= headcount) {
      flashValidation("All openings are filled");
      return;
    }
    if (!ensureOnlineForMutation()) return;

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("set_application_status", {
      p_application_id: applicationId,
      p_status: status,
      p_rejection_reason: null,
    });

    if (!error) {
      const { data: app } = await supabase
        .from("applications")
        .select("freelancer_id")
        .eq("id", applicationId)
        .maybeSingle();
      if (app?.freelancer_id) {
        await supabase.rpc("create_notification", {
          p_user_id: app.freelancer_id,
          p_type: "selection",
          p_title:
            status === "accepted"
              ? "You've been accepted"
              : "Application declined",
          p_body: "Open My Gigs for details.",
          p_meta: { job_id: jobId, status },
        });
      }
    }

    setLoading(false);
    if (error) {
      presentAppError(error, {
        onRetry: () => void setStatus(status),
      });
      return;
    }
    flashSuccess(status === "accepted" ? "Selected" : "Rejected");
    onApplicationChanged?.();
    router.refresh();
  }

  if (!isSelectionOpen(jobStatus)) {
    return null;
  }

  if (currentStatus === "accepted") {
    return null;
  }

  if (currentStatus === "rejected") {
    return (
      <div className="flex w-full gap-2.5">
        <Button
          variant="outline"
          className={cn(binaryChoiceClassNames.positive, "flex-1")}
          disabled={loading || acceptedCount >= headcount}
          onClick={() => setStatus("accepted")}
        >
          <Check className="size-4" strokeWidth={2.5} />
          Select
        </Button>
      </div>
    );
  }

  if (currentStatus !== "applied") {
    return null;
  }

  return (
    <BinaryChoice
      positiveLabel="Select"
      negativeLabel="Reject"
      negativeTone="reject"
      disabled={loading}
      positiveDisabled={acceptedCount >= headcount}
      onPositive={() => setStatus("accepted")}
      onNegative={() => setStatus("rejected")}
    />
  );
}
