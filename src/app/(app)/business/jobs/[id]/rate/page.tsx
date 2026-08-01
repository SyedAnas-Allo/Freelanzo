"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageLoading } from "@/components/page-loading";
import { RateClient } from "@/components/rate-client";
import { useRouter } from "@/hooks/use-app-router";
import { fetchSessionProfile } from "@/hooks/use-session-profile";
import { createClient } from "@/lib/supabase/client";
import type { Job } from "@/types/database";

export default function BusinessRatePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notFoundState, setNotFoundState] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [alreadyRated, setAlreadyRated] = useState(false);
  const [counterpartName, setCounterpartName] = useState("Freelancer");
  const [reportedUserId, setReportedUserId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { user, business } = await fetchSessionProfile();
      if (!business) {
        router.replace("/business/setup");
        return;
      }
      if (!user) {
        router.replace("/login");
        return;
      }

      const supabase = createClient();
      const { data: jobRow } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", id)
        .eq("business_id", business.id)
        .maybeSingle();
      if (!jobRow) {
        setNotFoundState(true);
        setLoading(false);
        return;
      }

      const { data: apps } = await supabase
        .from("applications")
        .select("id, freelancer_id, profiles(full_name)")
        .eq("job_id", id)
        .eq("status", "accepted");

      const appList = apps ?? [];
      if (!appList.length) {
        router.replace(`/business/jobs/${id}/applicants`);
        return;
      }

      const appIds = appList.map((application) => application.id);
      const [{ data: confirmedPayments }, { data: ratings }] =
        await Promise.all([
          supabase
            .from("payments")
            .select("application_id")
            .in("application_id", appIds)
            .eq("status", "confirmed"),
          supabase
            .from("ratings")
            .select("application_id")
            .in("application_id", appIds)
            .eq("from_user_id", user.id),
        ]);

      const eligibleIds = new Set(
        (confirmedPayments ?? []).map((payment) => payment.application_id),
      );
      const eligible = appList.filter((application) =>
        eligibleIds.has(application.id),
      );
      if (!eligible.length) {
        router.replace(`/business/jobs/${id}/payment`);
        return;
      }

      const ratedIds = new Set(
        (ratings ?? []).map((rating) => rating.application_id),
      );
      const target =
        eligible.find((application) => !ratedIds.has(application.id)) ??
        eligible[0]!;
      const { data: existing } = await supabase
        .from("ratings")
        .select("id")
        .eq("application_id", target.id)
        .eq("from_user_id", user.id)
        .maybeSingle();

      const name =
        (target.profiles as unknown as { full_name: string | null } | null)
          ?.full_name || "Freelancer";

      setJob(jobRow as Job);
      setApplicationId(target.id);
      setAlreadyRated(!!existing);
      setCounterpartName(name);
      setReportedUserId(target.freelancer_id);
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
      mode="business"
      alreadyRated={alreadyRated}
      counterpartName={counterpartName}
      reportedUserId={reportedUserId}
    />
  );
}
