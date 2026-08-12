"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useRouter } from "@/hooks/use-app-router";
import { Briefcase, UserRound } from "lucide-react";
import { ContactActionBar } from "@/components/actions/contact-action-bar";
import { ApplicantActions } from "@/components/applicant-actions";
import { FreelancerProfileView } from "@/components/freelancer-profile-view";
import { PageBack } from "@/components/page-back";
import { PageLoading } from "@/components/page-loading";
import { ReportMenuButton } from "@/components/report-menu-button";
import { SettingsGroup, SettingsRow } from "@/components/settings-row";
import { Badge } from "@/components/ui/badge";
import { loadFreelancerStats } from "@/lib/load-freelancer-stats";
import {
  type FreelancerProfileStats,
} from "@/lib/profile-stats";
import {
  applicationStatusLabel,
  applicationStatusVariant,
  isHiredStatus,
  isJobPhoneUnlocked,
} from "@/lib/status";
import { createClient } from "@/lib/supabase/client";
import type { Application, BusinessProfile, Job, Profile } from "@/types/database";

const EMPTY_STATS: FreelancerProfileStats = {
  jobsCompleted: 0,
  acceptedJobs: 0,
  attendanceRate: 100,
  cancellationRate: 0,
  noShowRate: 0,
  reliability: 80,
  avgRating: null,
  reviewCount: 0,
  totalEarnings: 0,
  jobsInProgress: 0,
};

export default function FreelancerProfilePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <FreelancerProfileInner />
    </Suspense>
  );
}

function FreelancerProfileInner() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params.id;
  const jobId = searchParams.get("job");

  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<FreelancerProfileStats>(EMPTY_STATS);
  const [application, setApplication] = useState<Application | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [acceptedCount, setAcceptedCount] = useState(0);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: business } = await supabase
        .from("business_profiles")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (!business) {
        router.push("/business/setup");
        return;
      }
      const biz = business as BusinessProfile;

      const { data: profileRow } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!profileRow) {
        setMissing(true);
        setLoading(false);
        return;
      }

      const p = profileRow as Profile;
      setProfile(p);
      setStats(await loadFreelancerStats(supabase, id));

      if (jobId) {
        const { data: jobRow } = await supabase
          .from("jobs")
          .select("*")
          .eq("id", jobId)
          .eq("business_id", biz.id)
          .maybeSingle();
        const nextJob = (jobRow as Job) ?? null;
        setJob(nextJob);

        if (nextJob) {
          const { data: app } = await supabase
            .from("applications")
            .select("*")
            .eq("job_id", jobId)
            .eq("freelancer_id", id)
            .maybeSingle();
          setApplication((app as Application) ?? null);

          const { count: a } = await supabase
            .from("applications")
            .select("*", { count: "exact", head: true })
            .eq("job_id", jobId)
            .eq("status", "accepted");
          setAcceptedCount(a ?? 0);
        }
      }

      setLoading(false);
    }
    void load();
  }, [id, jobId, router]);

  if (loading) return <PageLoading />;

  if (missing || !profile) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="font-bold">Freelancer not found</p>
        <Link href="/business" className="mt-4 inline-block text-sm font-bold text-primary">
          Back
        </Link>
      </div>
    );
  }

  const reveal = application ? isHiredStatus(application.status) : false;
  const phoneUnlocked = job ? isJobPhoneUnlocked(job.status) : false;
  const photos: string[] = [];

  return (
    <div className="space-y-4 px-4 pb-8">
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
              reportedUserId={profile.id}
              reportedName={profile.full_name || "Freelancer"}
              jobId={job.id}
              applicationId={application.id}
            />
          ) : null}
        </div>
      </div>

      <FreelancerProfileView
        profile={profile}
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
                  phone={phoneUnlocked ? profile.phone : null}
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
