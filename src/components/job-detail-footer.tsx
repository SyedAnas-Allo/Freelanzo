"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "@/hooks/use-app-router";
import { CalendarClock, MapPin } from "lucide-react";
import { InfoCallout } from "@/components/info-callout";
import { SwipeToConfirm } from "@/components/swipe-to-confirm";
import { Button } from "@/components/ui/button";
import {
  checkJobEligibility,
  type EligibilityBlock,
} from "@/lib/profile-eligibility";
import {
  ensureOnlineForMutation,
  flashSuccess,
  presentAppError,
} from "@/lib/flash-message";
import {
  canApplyOrReapply,
  resolveJobFooterAction,
} from "@/lib/job-footer-action";
import { createClient } from "@/lib/supabase/client";
import {
  daysBetweenISO,
  formatWorkDateShort,
  localDateISO,
} from "@/lib/work-dates";
import type { ApplicationStatus, Job, Profile } from "@/types/database";

type FooterCta = {
  label: string;
  href: string;
  kind: "primary" | "secondary" | "done" | "waiting";
} | null;

export function JobDetailFooter({
  footerCta,
  hired,
  jobId,
  applicationId,
  applicationStatus,
  closed,
  mapsUrl,
  scheduledCheckInDate,
  eligibilityBlock,
  jobRequirements,
}: {
  footerCta: FooterCta;
  hired: boolean;
  jobId: string;
  applicationId?: string | null;
  applicationStatus?: ApplicationStatus | null;
  closed: boolean;
  mapsUrl: string;
  scheduledCheckInDate?: string | null;
  eligibilityBlock?: EligibilityBlock | null;
  jobRequirements?: Pick<Job, "gender_preference" | "skilled">;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function notifyBusiness() {
    const supabase = createClient();
    const { data: job } = await supabase
      .from("jobs")
      .select("title, business_id, business_profiles(owner_id)")
      .eq("id", jobId)
      .maybeSingle();

    const ownerId = (
      job as {
        business_profiles?: { owner_id?: string } | null;
      } | null
    )?.business_profiles?.owner_id;

    if (ownerId) {
      await supabase.rpc("create_notification", {
        p_user_id: ownerId,
        p_type: "application_received",
        p_title: "New application",
        p_body: `Someone applied for ${job?.title ?? "your gig"}`,
        p_meta: { job_id: jobId },
      });
    }
  }

  async function loadEligibility(): Promise<EligibilityBlock | null> {
    if (!jobRequirements) return eligibilityBlock ?? null;

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    if (!user) return null;

    const { data } = await supabase
      .from("profiles")
      .select("full_name, phone, lat, lng, gender, date_of_birth, work_type")
      .eq("id", user.id)
      .maybeSingle();

    const profile = data as Pick<
      Profile,
      | "full_name"
      | "phone"
      | "lat"
      | "lng"
      | "gender"
      | "date_of_birth"
      | "work_type"
    > | null;
    if (!profile) return null;

    const jobPath = `/freelancer/jobs/${jobId}`;
    const result = checkJobEligibility(profile, jobRequirements, {
      editProfileHref: `/profile/edit?returnTo=${encodeURIComponent(jobPath)}`,
      setupHref: `/onboarding?returnTo=${encodeURIComponent(jobPath)}`,
    });
    return result.ok ? null : result;
  }

  async function apply() {
    if (!ensureOnlineForMutation()) return;
    setLoading(true);
    const block = await loadEligibility();
    if (block) {
      setLoading(false);
      presentAppError({
        category: "eligibility",
        message: block.message,
        retryable: false,
        action: block.fixHref
          ? { label: "Fix profile", href: block.fixHref }
          : undefined,
      });
      if (block.code === "profile_incomplete" && block.fixHref) {
        router.push(block.fixHref);
      }
      return;
    }

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    if (!user) {
      setLoading(false);
      presentAppError(new Error("Not authenticated"));
      router.push("/login");
      return;
    }

    const { error } = await supabase.from("applications").insert({
      job_id: jobId,
      freelancer_id: user.id,
      status: "applied",
    });

    if (error) {
      setLoading(false);
      presentAppError(error, { op: "apply", onRetry: () => void apply() });
      return;
    }

    await notifyBusiness();
    setLoading(false);
    flashSuccess("Application submitted!");
    router.push(`/freelancer/jobs/${jobId}/applied`);
    router.refresh();
  }

  async function reapply() {
    if (!applicationId) {
      presentAppError({
        category: "conflict",
        message: "Application not found",
        retryable: false,
      });
      return;
    }

    if (!ensureOnlineForMutation()) return;
    setLoading(true);
    const block = await loadEligibility();
    if (block) {
      setLoading(false);
      presentAppError({
        category: "eligibility",
        message: block.message,
        retryable: false,
        action: block.fixHref
          ? { label: "Fix profile", href: block.fixHref }
          : undefined,
      });
      if (block.code === "profile_incomplete" && block.fixHref) {
        router.push(block.fixHref);
      }
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.rpc("reapply_application", {
      p_application_id: applicationId,
    });

    if (error) {
      setLoading(false);
      presentAppError(error, { op: "apply", onRetry: () => void reapply() });
      return;
    }

    await notifyBusiness();
    setLoading(false);
    flashSuccess("Application submitted!");
    router.push(`/freelancer/jobs/${jobId}/applied`);
    router.refresh();
  }

  const action = resolveJobFooterAction({
    applicationStatus,
    lifecycleCta: footerCta,
    closed,
    eligibilityBlock,
  });

  if (scheduledCheckInDate) {
    const daysUntilCheckIn = Math.max(
      0,
      daysBetweenISO(localDateISO(), scheduledCheckInDate),
    );
    const scheduledLabel =
      daysUntilCheckIn === 0
        ? "Check-in is today"
        : `Check-in in ${daysUntilCheckIn} ${daysUntilCheckIn === 1 ? "day" : "days"}`;

    return (
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[430px] border-t border-border/50 bg-background/95 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <Button
          type="button"
          disabled
          className="h-11 w-full rounded-full border border-amber-300 bg-amber-100 text-sm font-bold text-amber-950 shadow-none disabled:opacity-100 dark:border-amber-700 dark:bg-amber-900/60 dark:text-amber-100"
        >
          <CalendarClock className="size-4" />
          {scheduledLabel} · {formatWorkDateShort(scheduledCheckInDate)}
        </Button>
      </div>
    );
  }

  if (action.kind === "hidden") return null;

  const label = action.label;
  const disabled = action.kind === "blocked";
  let onConfirm: (() => void) | undefined;

  if (action.kind === "navigate" || action.kind === "fix_profile") {
    onConfirm = () => router.push(action.href);
  } else if (action.kind === "apply") {
    onConfirm = () => {
      void apply();
    };
  } else if (action.kind === "reapply") {
    onConfirm = () => {
      void reapply();
    };
  }

  const showGoToLocation =
    hired &&
    action.kind === "navigate" &&
    action.href.includes("/check-in");

  const showEligibility =
    !!eligibilityBlock && canApplyOrReapply(applicationStatus);

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[430px] border-t border-border/50 bg-background/95 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
      {showEligibility ? (
        <div className="mb-2">
          <InfoCallout
            title={
              eligibilityBlock.code === "under_18"
                ? "Age requirement"
                : eligibilityBlock.code === "gender_mismatch"
                  ? "Gender preference"
                  : eligibilityBlock.code === "profile_incomplete"
                    ? "Complete your profile"
                    : "Skilled role"
            }
            variant="important"
          >
            <p>{eligibilityBlock.message}</p>
            {eligibilityBlock.fixHref ? (
              <Button
                variant="outline"
                className="mt-2.5 h-8 rounded-lg border-red-200 bg-white text-xs font-semibold text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
                asChild
              >
                <Link href={eligibilityBlock.fixHref}>
                  {eligibilityBlock.code === "profile_incomplete"
                    ? "Set up profile"
                    : "Update profile"}
                </Link>
              </Button>
            ) : null}
          </InfoCallout>
        </div>
      ) : null}
      {showGoToLocation ? (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="mb-1.5 flex items-center justify-center gap-1 text-[12px] font-semibold text-primary"
        >
          <MapPin className="size-3.5" />
          Go to location
        </a>
      ) : null}
      <SwipeToConfirm
        label={disabled ? label : `Swipe to ${label.toLowerCase()}`}
        confirmLabel={label}
        disabled={disabled}
        loading={loading}
        onConfirm={onConfirm ?? (() => {})}
      />
    </div>
  );
}
