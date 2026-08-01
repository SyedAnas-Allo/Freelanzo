"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BusinessPaymentClient } from "@/components/business-payment-client";
import { PageLoading } from "@/components/page-loading";
import { useRouter } from "@/hooks/use-app-router";
import { fetchSessionProfile } from "@/hooks/use-session-profile";
import { createClient } from "@/lib/supabase/client";
import { isAttendanceComplete, jobWorkDates } from "@/lib/work-dates";
import type { Job, Payment, Profile } from "@/types/database";

type WorkerRow = {
  applicationId: string;
  profile: Profile;
  payment: Payment | null;
};

export default function BusinessPaymentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notFoundState, setNotFoundState] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [workers, setWorkers] = useState<WorkerRow[]>([]);

  useEffect(() => {
    async function load() {
      const { business } = await fetchSessionProfile();
      if (!business) {
        router.replace("/business/setup");
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
      const typedJob = jobRow as Job;
      const dates = jobWorkDates(typedJob);

      const { data: apps } = await supabase
        .from("applications")
        .select("id, profiles(*)")
        .eq("job_id", id)
        .eq("status", "accepted");

      const appIds = (apps ?? []).map((a) => a.id);
      const [{ data: payments }, { data: events }] = await Promise.all([
        appIds.length
          ? supabase.from("payments").select("*").in("application_id", appIds)
          : Promise.resolve({ data: [] as Payment[] }),
        appIds.length
          ? supabase
              .from("attendance_events")
              .select("application_id, kind, work_date")
              .in("application_id", appIds)
          : Promise.resolve({
              data: [] as {
                application_id: string;
                kind: string;
                work_date: string;
              }[],
            }),
      ]);

      const eventsByApp = new Map<
        string,
        { kind: string; work_date: string }[]
      >();
      for (const e of events ?? []) {
        const list = eventsByApp.get(e.application_id) ?? [];
        list.push({ kind: e.kind, work_date: e.work_date });
        eventsByApp.set(e.application_id, list);
      }

      const eligibleApps = (apps ?? []).filter((a) =>
        isAttendanceComplete(dates, eventsByApp.get(a.id) ?? []),
      );

      if (eligibleApps.length === 0) {
        router.replace(`/business/jobs/${id}/attendance`);
        return;
      }

      const payMap = new Map(
        (payments ?? []).map((p) => [p.application_id, p as Payment]),
      );

      setJob(typedJob);
      setWorkers(
        eligibleApps.map((a) => ({
          applicationId: a.id,
          profile: a.profiles as unknown as Profile,
          payment: payMap.get(a.id) ?? null,
        })),
      );
      setLoading(false);
    }
    void load();
  }, [id, router]);

  if (loading) return <PageLoading />;
  if (notFoundState || !job) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        Not found
      </div>
    );
  }

  return <BusinessPaymentClient job={job} workers={workers} />;
}
