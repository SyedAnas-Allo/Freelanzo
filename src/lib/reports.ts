export type ReportDirection =
  | "freelancer_to_business"
  | "business_to_freelancer";

export type ReportReason = {
  key: string;
  label: string;
};

const SHARED_REASONS: ReportReason[] = [
  { key: "harassment", label: "Harassment or inappropriate behaviour" },
  { key: "safety", label: "Safety concern" },
  { key: "misleading", label: "Fake or misleading info" },
  { key: "other", label: "Other" },
];

const FREELANCER_TO_BUSINESS_EXTRA: ReportReason[] = [
  { key: "job_mismatch", label: "Job was different than posted" },
  { key: "payment_pressure", label: "Non-payment or payment pressure" },
  { key: "unsafe_workplace", label: "Unsafe workplace" },
];

const BUSINESS_TO_FREELANCER_EXTRA: ReportReason[] = [
  { key: "no_show", label: "No-show or abandoned gig" },
  { key: "misconduct", label: "Misconduct on site" },
  { key: "fake_identity", label: "Fake identity or documents" },
];

/** Direction-specific extras first, then shared reasons (Other last). */
export function reportReasonsFor(direction: ReportDirection): ReportReason[] {
  const extras =
    direction === "freelancer_to_business"
      ? FREELANCER_TO_BUSINESS_EXTRA
      : BUSINESS_TO_FREELANCER_EXTRA;
  const sharedWithoutOther = SHARED_REASONS.filter((r) => r.key !== "other");
  const other = SHARED_REASONS.find((r) => r.key === "other")!;
  return [...extras, ...sharedWithoutOther, other];
}

export function reasonRequiresDetails(reasonKey: string) {
  return reasonKey === "other";
}

export type SubmitReportInput = {
  reporterId: string;
  reportedUserId: string;
  jobId: string | null;
  applicationId: string | null;
  reason: string;
  details: string | null;
};

export type SubmitReportResult =
  | { ok: true }
  | { ok: false; duplicate: true }
  | { ok: false; duplicate: false; message: string };

type ReportRow = { id: string };

/** Minimal query surface used by submitReport (keeps tests free of Supabase). */
export type ReportsStore = {
  findExisting: (input: {
    reporterId: string;
    reportedUserId: string;
    jobId: string | null;
    applicationId: string | null;
  }) => Promise<{ data: ReportRow | null; error: { message: string } | null }>;
  insert: (
    row: Omit<SubmitReportInput, "details"> & { details: string | null },
  ) => Promise<{ error: { message: string } | null }>;
};

/** Adapts a Supabase client (browser or server) to ReportsStore. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSupabaseReportsStore(supabase: any): ReportsStore {
  return {
    async findExisting(input) {
      let query = supabase
        .from("reports")
        .select("id")
        .eq("reporter_id", input.reporterId)
        .eq("reported_user_id", input.reportedUserId);

      if (input.jobId) {
        query = query.eq("job_id", input.jobId);
      } else if (input.applicationId) {
        query = query.eq("application_id", input.applicationId);
      }

      return query.maybeSingle();
    },
    async insert(row) {
      return supabase.from("reports").insert({
        reporter_id: row.reporterId,
        reported_user_id: row.reportedUserId,
        job_id: row.jobId,
        application_id: row.applicationId,
        reason: row.reason,
        details: row.details,
      });
    },
  };
}

export async function submitReport(
  store: ReportsStore,
  input: SubmitReportInput,
): Promise<SubmitReportResult> {
  const details = input.details?.trim() ? input.details.trim() : null;

  if (reasonRequiresDetails(input.reason) && !details) {
    return { ok: false, duplicate: false, message: "Please add a short note" };
  }

  const { data: existing, error: existingError } = await store.findExisting({
    reporterId: input.reporterId,
    reportedUserId: input.reportedUserId,
    jobId: input.jobId,
    applicationId: input.applicationId,
  });

  if (existingError) {
    return { ok: false, duplicate: false, message: existingError.message };
  }
  if (existing) {
    return { ok: false, duplicate: true };
  }

  const { error } = await store.insert({
    reporterId: input.reporterId,
    reportedUserId: input.reportedUserId,
    jobId: input.jobId,
    applicationId: input.applicationId,
    reason: input.reason,
    details,
  });

  if (error) {
    return { ok: false, duplicate: false, message: error.message };
  }

  return { ok: true };
}
