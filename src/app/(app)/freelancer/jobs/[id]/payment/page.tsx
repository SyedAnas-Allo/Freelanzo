"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { FreelancerPaymentClient } from "@/components/freelancer-payment-client";
import { PageLoading } from "@/components/page-loading";
import { useRouter } from "@/hooks/use-app-router";
import { fetchSessionProfile } from "@/hooks/use-session-profile";
import { createClient } from "@/lib/supabase/client";
import { isAttendanceComplete, jobWorkDates } from "@/lib/work-dates";
import type { Job, Payment } from "@/types/database";

export default function FreelancerPaymentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notFoundState, setNotFoundState] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);

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
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!jobRow) {
        setNotFoundState(true);
        setLoading(false);
        return;
      }
      const typedJob = jobRow as Job;

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

      const { data: events } = await supabase
        .from("attendance_events")
        .select("kind, work_date")
        .eq("application_id", app.id);

      if (!isAttendanceComplete(jobWorkDates(typedJob), events ?? [])) {
        router.replace(`/freelancer/jobs/${id}`);
        return;
      }

      const { data: paymentRow } = await supabase
        .from("payments")
        .select("*")
        .eq("application_id", app.id)
        .maybeSingle();

      setJob(typedJob);
      setApplicationId(app.id);
      setPayment((paymentRow as Payment | null) ?? null);
      setLoading(false);
    }
    void load();
  }, [id, router]);

  if (loading) return <PageLoading />;
  if (notFoundState || !job || !applicationId) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        Not found
      </div>
    );
  }

  return (
    <FreelancerPaymentClient
      job={job}
      applicationId={applicationId}
      payment={payment}
    />
  );
}
