"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageLoading } from "@/components/page-loading";
import { RateClient } from "@/components/rate-client";
import { useRouter } from "@/hooks/use-app-router";
import { fetchSessionProfile } from "@/hooks/use-session-profile";
import { createClient } from "@/lib/supabase/client";
import type { Job } from "@/types/database";

export default function FreelancerRatePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notFoundState, setNotFoundState] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [alreadyRated, setAlreadyRated] = useState(false);
  const [counterpartName, setCounterpartName] = useState("Business");
  const [reportedUserId, setReportedUserId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { user } = await fetchSessionProfile();
      if (!user) {
        router.replace("/login");
        return;
      }

      const supabase = createClient();
      const { data: jobRow } = await supabase
        .from("jobs")
        .select("*, business_profiles(business_name, owner_id)")
        .eq("id", id)
        .maybeSingle();
      if (!jobRow) {
        setNotFoundState(true);
        setLoading(false);
        return;
      }

      const { data: app } = await supabase
        .from("applications")
        .select("id")
        .eq("job_id", id)
        .eq("freelancer_id", user.id)
        .eq("status", "accepted")
        .maybeSingle();
      if (!app) {
        router.replace(`/freelancer/jobs/${id}`);
        return;
      }

      const { data: payment } = await supabase
        .from("payments")
        .select("status")
        .eq("application_id", app.id)
        .maybeSingle();

      if (!payment || payment.status !== "confirmed") {
        router.replace(`/freelancer/jobs/${id}/payment`);
        return;
      }

      const { data: existing } = await supabase
        .from("ratings")
        .select("id")
        .eq("application_id", app.id)
        .eq("from_user_id", user.id)
        .maybeSingle();

      const biz = jobRow.business_profiles as unknown as {
        business_name: string;
        owner_id: string;
      } | null;

      if (!biz?.owner_id) {
        setNotFoundState(true);
        setLoading(false);
        return;
      }

      setJob(jobRow as Job);
      setApplicationId(app.id);
      setAlreadyRated(!!existing);
      setCounterpartName(biz.business_name || "Business");
      setReportedUserId(biz.owner_id);
      setLoading(false);
    }
    void load();
  }, [id, router]);

  if (loading) return <PageLoading />;
  if (notFoundState || !job || !applicationId || !reportedUserId) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        Not found
      </div>
    );
  }

  return (
    <RateClient
      job={job}
      applicationId={applicationId}
      mode="freelancer"
      alreadyRated={alreadyRated}
      counterpartName={counterpartName}
      reportedUserId={reportedUserId}
    />
  );
}
