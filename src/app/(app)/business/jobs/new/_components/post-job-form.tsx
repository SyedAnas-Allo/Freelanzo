"use client";

import { ArrowRight } from "lucide-react";
import { PageContent } from "@/components/layout/page-content";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { JobBasicsFields } from "@/features/jobs/post-job/job-basics-fields";
import { JobDescriptionFields } from "@/features/jobs/post-job/job-description-fields";
import { JobPostingConsent } from "@/features/jobs/post-job/job-posting-consent";
import { JobScheduleFields } from "@/features/jobs/post-job/job-schedule-fields";
import { usePostJobForm } from "@/features/jobs/post-job/use-post-job-form";
import { formatPay } from "@/lib/utils";

export function PostJobForm() {
  const controller = usePostJobForm();

  return (
    <PageContent className="pb-10">
      <PageHeader
        backHref="/business"
        title="Post a New Gig"
        description="Pin the workplace so freelancers nearby can find it."
      />

      <JobBasicsFields controller={controller} />
      <JobScheduleFields controller={controller} />
      <JobDescriptionFields controller={controller} />
      <JobPostingConsent controller={controller} />

      <Button
        className="h-12 w-full rounded-xl"
        disabled={controller.loading || !controller.paymentAccepted}
        onClick={controller.continueToPay}
      >
        {controller.loading
          ? "Preparing…"
          : `Proceed to Pay · ${formatPay(controller.postingFee)}`}
        {!controller.loading ? <ArrowRight className="size-4" /> : null}
      </Button>
    </PageContent>
  );
}
