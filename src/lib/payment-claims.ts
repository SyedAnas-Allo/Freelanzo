import type { SupabaseClient } from "@supabase/supabase-js";
import { jobEngagementTotal } from "@/lib/utils";
import { jobWorkDates } from "@/lib/work-dates";
import type { Job, Payment } from "@/types/database";

export function expectedEngagementAmount(job: Job): number {
  return jobEngagementTotal({
    ...job,
    work_dates: jobWorkDates(job),
  });
}

export async function upsertFreelancerPaymentClaim(
  supabase: SupabaseClient,
  applicationId: string,
  claim: "received" | "not_received",
  complaint?: string | null,
): Promise<Payment> {
  const { data, error } = await supabase.rpc("upsert_payment_claim", {
    p_application_id: applicationId,
    p_role: "freelancer",
    p_claim: claim,
    p_complaint: claim === "not_received" ? complaint || "Payment not received" : null,
  });
  if (error) throw error;
  return data as Payment;
}

export async function upsertBusinessPaymentClaim(
  supabase: SupabaseClient,
  applicationId: string,
  job: Job,
  paid: boolean,
): Promise<Payment> {
  const { data, error } = await supabase.rpc("upsert_payment_claim", {
    p_application_id: applicationId,
    p_role: "business",
    p_claim: paid ? "paid" : "not_paid",
    p_amount: expectedEngagementAmount(job),
    p_method: null,
  });
  if (error) throw error;
  return data as Payment;
}
