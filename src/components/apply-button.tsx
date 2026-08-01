"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  applyEligibilityErrorMessage,
  checkJobEligibility,
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

export function ApplyButton({
  jobId,
  applicationId,
  alreadyApplied,
  closed,
  applicationStatus,
  jobRequirements,
}: {
  jobId: string;
  applicationId?: string | null;
  alreadyApplied: boolean;
  closed: boolean;
  applicationStatus?: "applied" | "accepted" | "rejected" | "cancelled" | null;
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

  async function assertEligible() {
    if (!jobRequirements) return true;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return true;
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
    if (!profile) return true;
    const jobPath = `/freelancer/jobs/${jobId}`;
    const result = checkJobEligibility(profile, jobRequirements, {
      editProfileHref: `/profile/edit?returnTo=${encodeURIComponent(jobPath)}`,
      setupHref: `/onboarding?returnTo=${encodeURIComponent(jobPath)}`,
    });
    if (!result.ok) {
      toast.error(result.message);
      if (result.code === "profile_incomplete" && result.fixHref) {
        router.push(result.fixHref);
      }
      return false;
    }
    return true;
  }

  async function apply() {
    setLoading(true);
    if (!(await assertEligible())) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
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
    if (!(await assertEligible())) {
      setLoading(false);
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

  if (applicationStatus === "cancelled") {
    if (closed) {
      return (
        <Button className="h-11 flex-[1.4] rounded-lg" disabled>
          Applications Closed
        </Button>
      );
    }

    return (
      <Button
        className="h-11 flex-[1.4] rounded-lg"
        onClick={reapply}
        disabled={loading}
      >
        {loading ? "Applying…" : "Apply Again"} <Send className="size-4" />
      </Button>
    );
  }

  if (alreadyApplied) {
    const label =
      applicationStatus === "accepted"
        ? "Selected"
        : applicationStatus === "rejected"
          ? "Not selected"
          : "Applied";
    return (
      <Button className="h-11 flex-[1.4] rounded-lg" disabled>
        {label}
      </Button>
    );
  }

  if (closed) {
    return (
      <Button className="h-11 flex-[1.4] rounded-lg" disabled>
        Applications Closed
      </Button>
    );
  }

  return (
    <Button
      className="h-11 flex-[1.4] rounded-lg"
      onClick={apply}
      disabled={loading}
    >
      {loading ? "Applying…" : "Apply Now"} <Send className="size-4" />
    </Button>
  );
}
