"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "@/hooks/use-app-router";
import { MapPin } from "lucide-react";
import { toast } from "sonner";
import { InfoCallout } from "@/components/info-callout";
import { SwipeToConfirm } from "@/components/swipe-to-confirm";
import { Button } from "@/components/ui/button";
import {
  applyEligibilityErrorMessage,
  checkJobEligibility,
  type EligibilityBlock,
} from "@/lib/profile-eligibility";
import { createClient } from "@/lib/supabase/client";
import type { Job, Profile } from "@/types/database";

const OVERLAP_MESSAGE =
  "You've already accepted another overlapping gig. Withdraw it first.";

function applyErrorMessage(message: string) {
  const eligibility = applyEligibilityErrorMessage(message);
  if (eligibility) return eligibility;
  if (
    message.includes("overlaps another application") ||
    message.includes("already accepted another overlapping job")
  ) {
    return OVERLAP_MESSAGE;
  }
  return message;
}

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
  alreadyApplied,
  applicationStatus,
  closed,
  mapsUrl,
  eligibilityBlock,
  jobRequirements,
}: {
  footerCta: FooterCta;
  hired: boolean;
  jobId: string;
  applicationId?: string | null;
  alreadyApplied: boolean;
  applicationStatus?: "applied" | "accepted" | "rejected" | "cancelled" | null;
  closed: boolean;
  mapsUrl: string;
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
    setLoading(true);
    const block = await loadEligibility();
    if (block) {
      setLoading(false);
      toast.error(block.message);
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
      toast.error("Please sign in");
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
      toast.error(applyErrorMessage(error.message));
      return;
    }

    await notifyBusiness();
    setLoading(false);
    toast.success("Application submitted!");
    router.push(`/freelancer/jobs/${jobId}/applied`);
    router.refresh();
  }

  async function reapply() {
    if (!applicationId) {
      toast.error("Application not found");
      return;
    }

    setLoading(true);
    const block = await loadEligibility();
    if (block) {
      setLoading(false);
      toast.error(block.message);
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
      toast.error(applyErrorMessage(error.message));
      return;
    }

    await notifyBusiness();
    setLoading(false);
    toast.success("Application submitted!");
    router.push(`/freelancer/jobs/${jobId}/applied`);
    router.refresh();
  }

  let label = "Apply Now";
  let disabled = false;
  let onConfirm: (() => void) | undefined;

  if (
    footerCta &&
    (footerCta.kind === "primary" || footerCta.kind === "secondary")
  ) {
    label = footerCta.label;
    onConfirm = () => router.push(footerCta.href);
  } else if (applicationStatus === "cancelled") {
    if (closed) {
      label = "Applications Closed";
      disabled = true;
    } else if (eligibilityBlock) {
      if (
        eligibilityBlock.code === "profile_incomplete" &&
        eligibilityBlock.fixHref
      ) {
        label = "Set Up Profile";
        onConfirm = () => router.push(eligibilityBlock.fixHref!);
      } else {
        label = "Can't Apply";
        disabled = true;
      }
    } else {
      label = "Apply Again";
      onConfirm = () => {
        void reapply();
      };
    }
  } else if (alreadyApplied) {
    // Applied / rejected / selected waiting states — status lives in the
    // lifecycle tracker; do not render a fake disabled swipe CTA.
    return null;
  } else if (closed) {
    label = "Applications Closed";
    disabled = true;
  } else if (eligibilityBlock) {
    if (eligibilityBlock.code === "profile_incomplete" && eligibilityBlock.fixHref) {
      label = "Set Up Profile";
      onConfirm = () => router.push(eligibilityBlock.fixHref!);
    } else {
      label = "Can't Apply";
      disabled = true;
    }
  } else {
    onConfirm = () => {
      void apply();
    };
  }

  const showGoToLocation =
    hired &&
    footerCta?.kind === "primary" &&
    footerCta.href.includes("/check-in");

  const showEligibility =
    !!eligibilityBlock &&
    (!alreadyApplied || applicationStatus === "cancelled") &&
    !footerCta;

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
