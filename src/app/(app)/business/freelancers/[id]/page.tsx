import { notFound, redirect } from "next/navigation";
import { Briefcase, UserRound } from "lucide-react";
import { ContactActionBar } from "@/components/actions/contact-action-bar";
import { ApplicantActions } from "@/components/applicant-actions";
import { FreelancerProfileView } from "@/components/freelancer-profile-view";
import { PageBack } from "@/components/page-back";
import { ReportMenuButton } from "@/components/report-menu-button";
import { SettingsGroup, SettingsRow } from "@/components/settings-row";
import { Badge } from "@/components/ui/badge";
import { getSessionProfile } from "@/lib/auth";
import { loadFreelancerStats } from "@/lib/load-freelancer-stats";
import { createClient } from "@/lib/supabase/server";
import {
  applicationStatusLabel,
  applicationStatusVariant,
  isHiredStatus,
  isJobPhoneUnlocked,
} from "@/lib/status";
import type { Application, Job, Profile } from "@/types/database";

export default async function FreelancerProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ job?: string }>;
}) {
  const { id } = await params;
  const { job: jobId } = await searchParams;
  const { business } = await getSessionProfile();
  if (!business) redirect("/business/setup");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!profile) notFound();

  const p = profile as Profile;
  const stats = await loadFreelancerStats(supabase, id);
  const photos: string[] = [];

  let application: Application | null = null;
  let job: Job | null = null;
  let acceptedCount = 0;

  if (jobId) {
    const { data: jobRow } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .eq("business_id", business.id)
      .maybeSingle();
    job = (jobRow as Job) ?? null;

    if (job) {
      const { data: app } = await supabase
        .from("applications")
        .select("*")
        .eq("job_id", jobId)
        .eq("freelancer_id", id)
        .maybeSingle();
      application = (app as Application) ?? null;

      const { count: a } = await supabase
        .from("applications")
        .select("*", { count: "exact", head: true })
        .eq("job_id", jobId)
        .eq("status", "accepted");
      acceptedCount = a ?? 0;
    }
  }

  const reveal = application ? isHiredStatus(application.status) : false;
  const phoneUnlocked = job ? isJobPhoneUnlocked(job.status) : false;

  return (
    <div className="space-y-4 px-4 py-4 pb-8">
      <div className="flex items-center justify-between gap-2">
        <PageBack
          href={jobId ? `/business/jobs/${jobId}/applicants` : "/business"}
        />
        <div className="flex items-center gap-1.5">
          {application ? (
            <Badge variant={applicationStatusVariant(application.status)} size="sm">
              {applicationStatusLabel(application.status)}
            </Badge>
          ) : null}
          {application && job ? (
            <ReportMenuButton
              direction="business_to_freelancer"
              reportedUserId={p.id}
              reportedName={p.full_name || "Freelancer"}
              jobId={job.id}
              applicationId={application.id}
            />
          ) : null}
        </div>
      </div>

      <FreelancerProfileView
        profile={p}
        stats={stats}
        workPhotos={photos}
        variant="public"
        footer={
          <div className="space-y-3">
            <div className="rounded-xl border border-border/70 bg-card p-4">
              <h2 className="text-sm font-extrabold">Contact</h2>
              {reveal && job ? (
                <ContactActionBar
                  className="mt-3"
                  phone={phoneUnlocked ? p.phone : null}
                  callLocked={!phoneUnlocked}
                  chatHref={`/messages/${job.id}`}
                />
              ) : (
                <p className="mt-2 flex items-start gap-2 text-sm font-light text-muted-foreground">
                  <UserRound className="mt-0.5 size-4 shrink-0 text-primary" />
                  Contact unlocks after you Accept.
                </p>
              )}
            </div>

            {application && job ? (
              <div className="rounded-xl border border-border/70 bg-card p-4">
                <h2 className="text-sm font-extrabold">Hiring actions</h2>
                <p className="mt-1 text-xs font-light text-muted-foreground">
                  For {job.title}
                </p>
                <div className="mt-3">
                  <ApplicantActions
                    applicationId={application.id}
                    jobId={job.id}
                    jobStatus={job.status}
                    currentStatus={application.status}
                    headcount={job.headcount}
                    acceptedCount={acceptedCount}
                  />
                </div>
              </div>
            ) : null}

            <SettingsGroup>
              <SettingsRow
                href={`/business/freelancers/${id}/experience${jobId ? `?job=${jobId}` : ""}`}
                icon={<Briefcase className="size-4" />}
                label="Work History"
                description="Past Freelanzo gigs"
              />
            </SettingsGroup>
          </div>
        }
      />
    </div>
  );
}
