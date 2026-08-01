"use client";

import { useRouter } from "@/hooks/use-app-router";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { JobHeroCard } from "@/components/job-hero-card";
import { PageContent } from "@/components/layout/page-content";
import { PageBack } from "@/components/page-back";
import { PaymentStatusCallout } from "@/components/payment-status-callout";
import { YesNoActionPair } from "@/components/yes-no-pair";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { Textarea } from "@/components/ui/textarea";
import {
  expectedEngagementAmount,
  upsertFreelancerPaymentClaim,
} from "@/lib/payment-claims";
import { createClient } from "@/lib/supabase/client";
import { formatPay } from "@/lib/utils";
import { jobWorkDates } from "@/lib/work-dates";
import type { Job, Payment } from "@/types/database";

export function FreelancerPaymentClient({
  job,
  applicationId,
  payment: initial,
}: {
  job: Job;
  applicationId: string;
  payment: Payment | null;
}) {
  const router = useRouter();
  const [payment, setPayment] = useState(initial);
  const [value, setValue] = useState<"yes" | "no" | null>(
    initial?.freelancer_claimed === "received"
      ? "yes"
      : initial?.freelancer_claimed === "not_received"
        ? "no"
        : null,
  );
  const [complaint, setComplaint] = useState(initial?.complaint ?? "");
  const [pending, startTransition] = useTransition();
  const workDays = jobWorkDates(job).length;

  function submit(next: "yes" | "no") {
    setValue(next);
    startTransition(async () => {
      try {
        const supabase = createClient();
        const updated = await upsertFreelancerPaymentClaim(
          supabase,
          applicationId,
          next === "yes" ? "received" : "not_received",
          next === "no" ? complaint || "Payment not received" : null,
        );
        setPayment(updated);
        toast.success("Payment response saved");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to update");
      }
    });
  }

  return (
    <PageContent>
      <PageBack href={`/freelancer/jobs/${job.id}`} />
      <JobHeroCard job={job} />

      <Surface>
        <h2 className="text-sm font-extrabold">Did you receive payment?</h2>
        <p className="mt-1 text-xs font-light text-muted-foreground">
          Expected amount:{" "}
          <span className="font-semibold text-emerald-600">
            {formatPay(payment?.amount ?? expectedEngagementAmount(job))}
          </span>
          {workDays > 1 ? (
            <span className="font-medium">
              {" "}
              (all {workDays} days, paid once)
            </span>
          ) : null}
        </p>
        <YesNoActionPair
          className="mt-4"
          yesLabel="Yes, Received"
          noLabel="Not Received"
          value={value}
          onChange={submit}
          disabled={pending || payment?.status === "confirmed"}
        />
        {value === "no" ? (
          <Textarea
            className="mt-3"
            placeholder="Describe the issue…"
            value={complaint}
            onChange={(event) => setComplaint(event.target.value)}
            onBlur={() => {
              if (value === "no") submit("no");
            }}
          />
        ) : null}
      </Surface>

      <PaymentStatusCallout role="freelancer" status={payment?.status ?? null} />

      <Button
        className="w-full"
        disabled={!payment || payment.status !== "confirmed"}
        onClick={() => router.push(`/freelancer/jobs/${job.id}/rate`)}
      >
        Continue to Rate Business
      </Button>
    </PageContent>
  );
}
