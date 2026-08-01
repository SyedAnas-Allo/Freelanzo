import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Banknote,
  CheckCircle2,
  IndianRupee,
  MapPin,
  Phone,
  Users,
} from "lucide-react";
import { NextStepsList } from "@/components/feedback/next-steps-list";
import { SuccessScreen } from "@/components/feedback/success-screen";
import { InfoCallout } from "@/components/info-callout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JobCategoryIcon } from "@/features/jobs/components/job-category-icon";
import { createClient } from "@/lib/supabase/server";
import { formatPay } from "@/lib/utils";
import type { Job } from "@/types/database";

export default async function JobPostedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!job) notFound();

  const typed = job as Job;

  return (
    <div className="flex min-h-[70dvh] flex-col px-4 py-8">
      <SuccessScreen
        title="Gig Posted Successfully!"
        description="Your gig is now live."
        icon="check-circle"
      />

      <div className="mt-6 rounded-lg border border-border/70 bg-card p-4 text-left">
        <div className="flex items-start gap-3">
          <JobCategoryIcon
            category={typed.category}
            className="size-12"
            iconClassName="size-6"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="font-extrabold">{typed.title}</p>
              <Badge variant="success" size="sm">
                Live
              </Badge>
            </div>
            <ul className="mt-2 space-y-1.5 text-xs font-light text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <Users aria-hidden="true" className="size-3.5 text-primary" />
                {typed.headcount} Freelancers Required
              </li>
              <li className="flex items-center gap-1.5">
                <MapPin aria-hidden="true" className="size-3.5 text-primary" />
                {typed.area}, {typed.city}
              </li>
              <li className="flex items-center gap-1.5">
                <IndianRupee
                  aria-hidden="true"
                  className="size-3.5 text-primary"
                />
                Budget: {formatPay(typed.pay_per_freelancer)} / Day
              </li>
            </ul>
          </div>
        </div>
      </div>

      <NextStepsList
        className="mt-6"
        steps={[
          {
            icon: Users,
            title: "Freelancers will apply",
            body: "Nearby freelancers will start applying soon.",
          },
          {
            icon: CheckCircle2,
            title: "Review and decide",
            body: "Accept or Reject each profile.",
          },
          {
            icon: Phone,
            title: "Call or chat",
            body: "Contact freelancers once someone is accepted.",
          },
        ]}
      />

      <InfoCallout
        className="mt-4"
        title="Immediate payment required"
        variant="important"
        icon={<Banknote className="size-4" />}
      >
        <p>Pay freelancers in full (Cash / UPI) as soon as the gig ends.</p>
        <p className="mt-1.5">
          Freelanzo does not hold wages — you pay them directly.
        </p>
        <p className="mt-1.5">
          Skipping or delaying payment can get your account suspended.
        </p>
      </InfoCallout>

      <div className="mt-auto pt-8">
        <Button className="h-11 w-full rounded-lg font-semibold" asChild>
          <Link href={`/business/jobs/${id}/applicants`}>View Applicants</Link>
        </Button>
        <Button
          variant="outline"
          className="mt-2 h-11 w-full rounded-lg font-semibold"
          asChild
        >
          <Link href="/business">Back to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
