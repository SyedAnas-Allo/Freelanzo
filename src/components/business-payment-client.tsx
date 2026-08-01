"use client";

import { useRouter } from "@/hooks/use-app-router";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { JobHeroCard } from "@/components/job-hero-card";
import { PageContent } from "@/components/layout/page-content";
import { PageBack } from "@/components/page-back";
import { PaymentStatusCallout } from "@/components/payment-status-callout";
import { WorkerPayRow } from "@/components/worker-pay-row";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import {
  expectedEngagementAmount,
  upsertBusinessPaymentClaim,
} from "@/lib/payment-claims";
import { createClient } from "@/lib/supabase/client";
import { formatPay } from "@/lib/utils";
import { jobWorkDates } from "@/lib/work-dates";
import type { Job, Payment, Profile } from "@/types/database";

type WorkerRow = {
  applicationId: string;
  profile: Profile;
  payment: Payment | null;
};

export function BusinessPaymentClient({
  job,
  workers: initialWorkers,
}: {
  job: Job;
  workers: WorkerRow[];
}) {
  const router = useRouter();
  const [workers, setWorkers] = useState(initialWorkers);
  const [pending, startTransition] = useTransition();

  function setWorkerPaid(applicationId: string, paid: boolean) {
    startTransition(async () => {
      try {
        const supabase = createClient();
        const payment = await upsertBusinessPaymentClaim(
          supabase,
          applicationId,
          job,
          paid,
        );
        setWorkers((prev) =>
          prev.map((worker) =>
            worker.applicationId === applicationId
              ? { ...worker, payment }
              : worker,
          ),
        );
        toast.success(paid ? "Marked as paid" : "Marked as not paid");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to update");
      }
    });
  }

  const allConfirmed =
    workers.length > 0 &&
    workers.every((worker) => worker.payment?.status === "confirmed");
  const confirmedCount = workers.filter(
    (worker) => worker.payment?.status === "confirmed",
  ).length;
  const anyDispute = workers.some(
    (worker) => worker.payment?.status === "dispute",
  );
  const allBusinessClaimed = workers.every(
    (worker) => worker.payment?.business_claimed,
  );
  const workDays = jobWorkDates(job).length;
  const amountPerFreelancer = expectedEngagementAmount(job);
  const totalPayout = amountPerFreelancer * workers.length;

  return (
    <PageContent>
      <PageBack href={`/business/jobs/${job.id}/attendance`} />
      <JobHeroCard
        job={{
          ...job,
          status: job.status === "completed" ? "completed" : job.status,
        }}
        statusOverride={job.status === "completed" ? "Completed" : undefined}
      />

      <Surface>
        <h2 className="text-sm font-extrabold">What you owe</h2>
        <dl className="mt-3 space-y-2 border-t border-border/60 pt-3 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="font-light text-muted-foreground">Per freelancer</dt>
            <dd className="font-bold">{formatPay(amountPerFreelancer)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="font-light text-muted-foreground">Freelancers</dt>
            <dd className="font-bold">{workers.length}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-border/60 pt-2">
            <dt className="font-semibold">Total</dt>
            <dd className="text-base font-extrabold text-emerald-600">
              {formatPay(totalPayout)}
            </dd>
          </div>
        </dl>
        <p className="mt-2.5 text-xs font-light text-muted-foreground">
          {workDays > 1
            ? `Covers all ${workDays} work days — pay each freelancer once, directly.`
            : "Pay each freelancer directly — Freelanzo never holds wages."}
        </p>
      </Surface>

      <Surface>
        <h2 className="text-sm font-extrabold">Confirm each freelancer</h2>
        <p className="mt-0.5 text-xs font-light text-muted-foreground">
          {confirmedCount} of {workers.length} confirmed by both sides
          {!allBusinessClaimed
            ? ` · ${workers.filter((worker) => worker.payment?.business_claimed).length}/${workers.length} marked by you`
            : ""}
        </p>
        <div className="mt-1 divide-y divide-border/60">
          {workers.map((worker) => {
            const claimed = worker.payment?.business_claimed;
            const paid =
              claimed === "paid" ? true : claimed === "not_paid" ? false : null;
            return (
              <WorkerPayRow
                key={worker.applicationId}
                name={worker.profile.full_name || "Freelancer"}
                role={
                  worker.profile.skills?.slice(0, 2).join(", ") ||
                  worker.profile.work_type
                }
                photoUrl={worker.profile.photo_url}
                paid={paid}
                disabled={pending || worker.payment?.status === "confirmed"}
                onToggle={(next) => setWorkerPaid(worker.applicationId, next)}
              />
            );
          })}
        </div>
      </Surface>

      <PaymentStatusCallout role="business" anyDispute={anyDispute} />

      <div className="space-y-2">
        <Button
          size="lg"
          className="w-full"
          disabled={!allConfirmed}
          onClick={() => router.push(`/business/jobs/${job.id}/rate`)}
        >
          Continue to Ratings
        </Button>
        {!allConfirmed ? (
          <p className="text-center text-xs font-light text-muted-foreground">
            {anyDispute
              ? "Resolve disputes before rating."
              : "Both sides must confirm payment for every freelancer before rating."}
          </p>
        ) : null}
      </div>
    </PageContent>
  );
}
