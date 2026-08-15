import {
  deriveApplicationLifecycle,
  type ApplicationLifecycle,
  type LifecycleActor,
} from "@/lib/application-lifecycle";
import { jobWorkDates } from "@/lib/work-dates";
import type {
  ApplicationStatus,
  Job,
  JobStatus,
  PaymentStatus,
} from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

export type LifecycleApplicationRow = {
  id: string;
  job_id: string;
  status: ApplicationStatus;
  freelancer_id?: string;
};

type PaymentRow = {
  application_id: string;
  status: PaymentStatus;
  business_claimed: string | null;
  freelancer_claimed: string | null;
};

type EventRow = {
  application_id: string;
  kind: string;
  work_date: string;
};

/**
 * Load attendance, payment, and rating data for a set of applications and
 * project each into an ApplicationLifecycle for the given actor.
 */
export async function loadApplicationLifecycles(
  supabase: SupabaseClient,
  opts: {
    applications: LifecycleApplicationRow[];
    jobsById: Map<string, Pick<Job, "id" | "status" | "work_dates" | "job_date" | "headcount">>;
    actor: LifecycleActor;
    actorUserId: string;
    acceptedCountByJob?: Map<string, number>;
    today?: string;
    /** Reuse a prior attendance query instead of fetching events again. */
    events?: EventRow[];
  },
): Promise<Map<string, ApplicationLifecycle>> {
  const result = new Map<string, ApplicationLifecycle>();
  const apps = opts.applications;
  if (apps.length === 0) return result;

  const applicationIds = apps.map((a) => a.id);

  const [{ data: fetchedEvents }, { data: payments }, { data: ratings }] =
    await Promise.all([
      opts.events
        ? Promise.resolve({ data: opts.events })
        : supabase
            .from("attendance_events")
            .select("application_id, kind, work_date")
            .in("application_id", applicationIds),
      supabase
        .from("payments")
        .select("application_id, status, business_claimed, freelancer_claimed")
        .in("application_id", applicationIds),
      supabase
        .from("ratings")
        .select("application_id")
        .in("application_id", applicationIds)
        .eq("from_user_id", opts.actorUserId),
    ]);

  const eventsByApp = new Map<string, EventRow[]>();
  for (const e of (fetchedEvents ?? []) as EventRow[]) {
    const list = eventsByApp.get(e.application_id) ?? [];
    list.push(e);
    eventsByApp.set(e.application_id, list);
  }

  const paymentByApp = new Map<string, PaymentRow>();
  for (const p of (payments ?? []) as PaymentRow[]) {
    paymentByApp.set(p.application_id, p);
  }

  const ratedApps = new Set(
    (ratings ?? []).map((r: { application_id: string }) => r.application_id),
  );

  for (const app of apps) {
    const job = opts.jobsById.get(app.job_id);
    if (!job) continue;

    const acceptedCount =
      opts.acceptedCountByJob?.get(app.job_id) ??
      apps.filter(
        (a) => a.job_id === app.job_id && a.status === "accepted",
      ).length;

    const payment = paymentByApp.get(app.id);

    result.set(
      app.id,
      deriveApplicationLifecycle({
        applicationId: app.id,
        jobId: app.job_id,
        applicationStatus: app.status,
        jobStatus: job.status as JobStatus,
        workDates: jobWorkDates(job),
        events: eventsByApp.get(app.id) ?? [],
        paymentStatus: payment?.status ?? null,
        businessClaimed: !!payment?.business_claimed,
        freelancerClaimed: !!payment?.freelancer_claimed,
        ratedByActor: ratedApps.has(app.id),
        headcount: job.headcount,
        acceptedCount,
        actor: opts.actor,
        today: opts.today,
      }),
    );
  }

  return result;
}
