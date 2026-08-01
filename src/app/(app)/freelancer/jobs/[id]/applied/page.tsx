"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  Briefcase,
  CheckCircle2,
  MapPin,
} from "lucide-react";
import { NextStepsList } from "@/components/feedback/next-steps-list";
import { SuccessScreen } from "@/components/feedback/success-screen";
import { PageLoading } from "@/components/page-loading";
import { PaymentResponsibilityCallout } from "@/components/payment-responsibility-callout";
import { ProfileCompletionCallout } from "@/components/profile-completion-callout";
import { Button } from "@/components/ui/button";
import { JobCategoryIcon } from "@/features/jobs/components/job-category-icon";
import { useRouter } from "@/hooks/use-app-router";
import { fetchSessionProfile } from "@/hooks/use-session-profile";
import { getProfileGaps } from "@/lib/profile-eligibility";
import { createClient } from "@/lib/supabase/client";
import {
  formatPay,
  formatTime,
  haversineKm,
  jobEngagementTotal,
} from "@/lib/utils";
import { formatWorkDatesLabel, jobWorkDates } from "@/lib/work-dates";
import type { Job, Profile } from "@/types/database";

type JobWithBusiness = Job & {
  business_profiles: { business_name: string; verified: boolean } | null;
};

export default function ApplicationSuccessPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<JobWithBusiness | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    async function load() {
      const session = await fetchSessionProfile();
      if (!session.user) {
        router.replace("/login");
        return;
      }

      const supabase = createClient();
      const { data: jobRow } = await supabase
        .from("jobs")
        .select("*, business_profiles(business_name, verified)")
        .eq("id", id)
        .maybeSingle();

      setProfile(session.profile);
      setJob((jobRow as JobWithBusiness | null) ?? null);
      setLoading(false);
    }
    void load();
  }, [id, router]);

  if (loading) return <PageLoading />;
  if (!job) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        Not found
      </div>
    );
  }

  const typed = job;
  const distance =
    profile?.lat !== null &&
    profile?.lat !== undefined &&
    profile.lng !== null &&
    profile.lng !== undefined
      ? haversineKm(profile.lat, profile.lng, typed.lat, typed.lng)
      : null;
  const workDates = jobWorkDates(typed);
  const profileGaps = profile ? getProfileGaps(profile) : [];
  const editHref = `/profile/edit?returnTo=${encodeURIComponent(`/freelancer/jobs/${id}/applied`)}`;

  return (
    <div className="flex min-h-[70dvh] flex-col px-4 py-8">
      <SuccessScreen
        title="Application Submitted!"
        description="Your application has been sent successfully."
        icon="check-circle"
      />

      <div className="mt-6 rounded-lg border border-border/70 bg-card p-3.5">
        <div className="flex gap-3">
          <JobCategoryIcon
            category={typed.category}
            className="size-12"
            iconClassName="size-6"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="truncate font-bold">{typed.title}</h2>
                <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  {typed.business_profiles?.business_name}
                  {typed.business_profiles?.verified ? (
                    <BadgeCheck
                      aria-hidden="true"
                      className="size-3.5 fill-sky-500 text-white"
                    />
                  ) : null}
                </p>
              </div>
              <p className="shrink-0 text-sm font-extrabold text-emerald-600 tabular-nums">
                {formatPay(typed.pay_per_freelancer)}
                <span className="block text-[10px] font-medium text-emerald-600/70">
                  / Day
                  {workDates.length > 1
                    ? ` · ${formatPay(jobEngagementTotal({ ...typed, work_dates: workDates }))} total`
                    : ""}
                </span>
              </p>
            </div>
            <p className="mt-2 text-[11px] font-light text-muted-foreground">
              {formatWorkDatesLabel(workDates)} · {formatTime(typed.start_time)}{" "}
              – {formatTime(typed.end_time)}
            </p>
            <p className="mt-1 flex items-center gap-1 text-[11px] font-light text-muted-foreground">
              <MapPin aria-hidden="true" className="size-3 text-primary" />
              {[typed.area, typed.city].filter(Boolean).join(", ")}
              {distance !== null ? ` · ${distance.toFixed(1)} km` : ""}
            </p>
          </div>
        </div>
      </div>

      <ProfileCompletionCallout
        className="mt-4"
        gaps={profileGaps}
        editHref={editHref}
      />

      <NextStepsList
        className="mt-6"
        steps={[
          {
            icon: Briefcase,
            title: "Business will review your profile",
            body: "You'll get a notification if selected.",
          },
          {
            icon: Bell,
            title: "Keep your phone nearby",
            body: "Be ready for calls or messages.",
          },
          {
            icon: CheckCircle2,
            title: "Check My Gigs",
            body: "All updates will appear in My Gigs.",
          },
        ]}
      />

      <PaymentResponsibilityCallout className="mt-4" />

      <div className="mt-auto pt-8">
        <Button className="relative h-11 w-full rounded-lg font-semibold" asChild>
          <Link href="/freelancer/my-jobs">
            Go to My Gigs
            <ArrowRight className="absolute right-4 size-4" />
          </Link>
        </Button>
        <Button
          variant="ghost"
          className="mt-2 h-10 w-full rounded-lg font-semibold text-primary"
          asChild
        >
          <Link href="/freelancer">Back to Home</Link>
        </Button>
      </div>
    </div>
  );
}
