import { buildAttendanceDayIndex } from "@/lib/attendance-days";
import { localDateISO } from "@/lib/work-dates";
import type {
  ApplicationStatus,
  AttendanceKind,
  JobStatus,
  PaymentStatus,
} from "@/types/database";

export type LifecycleActor = "freelancer" | "business";

export type MilestoneId =
  | "applied"
  | "selected"
  | "check_in"
  | "check_out"
  | "payment"
  | "rating";

export type MilestoneVisualState =
  | "completed"
  | "current"
  | "upcoming"
  | "exception";

export type AttendanceDayPhase =
  | "complete"
  | "checked_in"
  | "missed"
  | "today_check_in"
  | "today_check_out"
  | "scheduled";

export type LifecycleException =
  | "rejected"
  | "cancelled"
  | "missed_attendance"
  | "payment_dispute"
  | "job_cancelled"
  | null;

export type LifecycleCtaKind = "primary" | "secondary" | "done" | "waiting";

export type LifecycleCTA = {
  label: string;
  href: string;
  kind: LifecycleCtaKind;
} | null;

export type MilestoneView = {
  id: MilestoneId;
  label: string;
  state: MilestoneVisualState;
  detail?: string;
};

export type AttendanceDayView = {
  date: string;
  checkedIn: boolean;
  checkedOut: boolean;
  phase: AttendanceDayPhase;
};

export type ApplicationLifecycle = {
  applicationId: string;
  jobId: string;
  actor: LifecycleActor;
  applicationStatus: ApplicationStatus;
  exception: LifecycleException;
  statusText: string;
  milestones: MilestoneView[];
  attendance: {
    totalDays: number;
    checkInDone: number;
    checkOutDone: number;
    days: AttendanceDayView[];
    actionable:
      | { date: string; needs: AttendanceKind; reason: "today" | "missed" }
      | null;
  };
  cta: LifecycleCTA;
  paymentStatus: PaymentStatus | null;
  businessClaimed: boolean;
  freelancerClaimed: boolean;
  ratedByActor: boolean;
  attendanceComplete: boolean;
  selectionEditable: boolean;
};

export type LifecycleInput = {
  applicationId: string;
  jobId: string;
  applicationStatus: ApplicationStatus;
  jobStatus: JobStatus;
  workDates: string[];
  events: { kind: string; work_date: string }[];
  paymentStatus: PaymentStatus | null;
  businessClaimed: boolean;
  freelancerClaimed: boolean;
  ratedByActor: boolean;
  headcount: number;
  acceptedCount: number;
  actor: LifecycleActor;
  today?: string;
};

const MILESTONE_LABELS: Record<MilestoneId, string> = {
  applied: "Applied",
  selected: "Selected",
  check_in: "Check-in",
  check_out: "Check-out",
  payment: "Payment",
  rating: "Rating",
};

const ACTIVE_JOB = new Set<JobStatus>([
  "live",
  "fully_staffed",
  "confirmed",
  "in_progress",
  "completed",
]);

const SELECTION_OPEN = new Set<JobStatus>([
  "live",
  "fully_staffed",
  "confirmed",
]);

export function classifyAttendanceDays(
  workDates: string[],
  events: { kind: string; work_date: string }[],
  today = localDateISO(),
): AttendanceDayView[] {
  const index = buildAttendanceDayIndex(workDates, events);

  return workDates.map((date) => {
    const row = index.get(date)!;
    let phase: AttendanceDayPhase;
    if (row.complete) phase = "complete";
    else if (date > today) phase = "scheduled";
    else if (date < today) phase = "missed";
    else if (!row.checkedIn) phase = "today_check_in";
    else if (!row.checkedOut) phase = "today_check_out";
    else phase = "complete";

    return {
      date,
      checkedIn: row.checkedIn,
      checkedOut: row.checkedOut,
      phase,
    };
  });
}

export function nextActionableAttendance(
  days: AttendanceDayView[],
): { date: string; needs: AttendanceKind; reason: "today" | "missed" } | null {
  const missed = days.find((d) => d.phase === "missed");
  if (missed) {
    return {
      date: missed.date,
      needs: missed.checkedIn ? "check_out" : "check_in",
      reason: "missed",
    };
  }
  const todayIn = days.find((d) => d.phase === "today_check_in");
  if (todayIn) {
    return { date: todayIn.date, needs: "check_in", reason: "today" };
  }
  const todayOut = days.find((d) => d.phase === "today_check_out");
  if (todayOut) {
    return { date: todayOut.date, needs: "check_out", reason: "today" };
  }
  return null;
}

function milestoneState(
  id: MilestoneId,
  current: MilestoneId | null,
  completedThrough: MilestoneId | null,
  exception: LifecycleException,
): MilestoneVisualState {
  const order: MilestoneId[] = [
    "applied",
    "selected",
    "check_in",
    "check_out",
    "payment",
    "rating",
  ];
  const idx = order.indexOf(id);
  const currentIdx = current ? order.indexOf(current) : -1;
  const doneIdx = completedThrough ? order.indexOf(completedThrough) : -1;

  if (
    exception === "rejected" ||
    exception === "cancelled" ||
    exception === "job_cancelled"
  ) {
    if (id === "applied") return "completed";
    if (id === "selected" && exception === "rejected") return "exception";
    if (idx <= doneIdx) return "completed";
    return "upcoming";
  }

  if (exception === "missed_attendance" && (id === "check_in" || id === "check_out")) {
    if (current === id) return "exception";
  }
  if (exception === "payment_dispute" && id === "payment") {
    return "exception";
  }

  if (idx <= doneIdx) return "completed";
  if (id === current) return "current";
  if (currentIdx >= 0 && idx < currentIdx) return "completed";
  return "upcoming";
}

export function deriveApplicationLifecycle(
  input: LifecycleInput,
): ApplicationLifecycle {
  const today = input.today ?? localDateISO();
  const days = classifyAttendanceDays(input.workDates, input.events, today);
  const actionable = nextActionableAttendance(days);
  const checkInDone = days.filter((d) => d.checkedIn).length;
  const checkOutDone = days.filter((d) => d.checkedOut).length;
  const totalDays = Math.max(days.length, 1);
  const attendanceComplete =
    days.length > 0 && days.every((d) => d.phase === "complete");
  const multi = totalDays > 1;

  const selectionEditable =
    input.actor === "business" &&
    SELECTION_OPEN.has(input.jobStatus) &&
    (input.applicationStatus === "applied" ||
      input.applicationStatus === "rejected" ||
      (input.applicationStatus === "accepted" &&
        checkInDone === 0 &&
        checkOutDone === 0));

  let exception: LifecycleException = null;
  if (input.applicationStatus === "cancelled") exception = "cancelled";
  else if (input.applicationStatus === "rejected") exception = "rejected";
  else if (
    input.jobStatus === "cancelled" ||
    input.jobStatus === "expired"
  ) {
    exception = "job_cancelled";
  } else if (
    input.applicationStatus === "accepted" &&
    actionable?.reason === "missed"
  ) {
    exception = "missed_attendance";
  } else if (input.paymentStatus === "dispute") {
    exception = "payment_dispute";
  }

  let current: MilestoneId | null = null;
  let completedThrough: MilestoneId | null = null;
  let statusText = "";
  let cta: LifecycleCTA = null;

  const jobBase =
    input.actor === "business"
      ? `/business/jobs/${input.jobId}`
      : `/freelancer/jobs/${input.jobId}`;

  if (exception === "cancelled") {
    statusText = "Application withdrawn";
    completedThrough = "applied";
    cta =
      input.actor === "freelancer"
        ? { label: "Find gigs", href: "/freelancer", kind: "secondary" }
        : null;
  } else if (exception === "rejected") {
    statusText = "Not selected";
    completedThrough = "applied";
    current = "selected";
    if (input.actor === "business" && selectionEditable) {
      cta = {
        label: "Reconsider",
        href: `${jobBase}/applicants`,
        kind: "secondary",
      };
    } else if (input.actor === "freelancer") {
      cta = { label: "Find gigs", href: "/freelancer", kind: "secondary" };
    }
  } else if (exception === "job_cancelled") {
    statusText =
      input.jobStatus === "expired" ? "Gig expired" : "Gig cancelled";
    completedThrough = "applied";
    cta =
      input.actor === "freelancer"
        ? { label: "Find gigs", href: "/freelancer", kind: "secondary" }
        : { label: "View applicants", href: `${jobBase}/applicants`, kind: "secondary" };
  } else if (input.applicationStatus === "applied") {
    current = "selected";
    completedThrough = "applied";
    statusText =
      input.actor === "freelancer"
        ? "Waiting for selection"
        : "Review application";
    cta =
      input.actor === "business"
        ? {
            label: "Review applicant",
            href: `${jobBase}/applicants`,
            kind: "primary",
          }
        : {
            label: "View gig",
            href: jobBase,
            kind: "waiting",
          };
  } else if (input.applicationStatus === "accepted") {
    completedThrough = "selected";

    if (!attendanceComplete) {
      if (actionable?.reason === "missed") {
        current = actionable.needs === "check_in" ? "check_in" : "check_out";
        statusText =
          input.actor === "business"
            ? `Missed ${actionable.needs === "check_in" ? "check-in" : "check-out"} on ${actionable.date}`
            : `Missed attendance on ${actionable.date} — waiting for business`;
        cta =
          input.actor === "business"
            ? {
                label: "Correct attendance",
                href: `${jobBase}/attendance?kind=${actionable.needs}&date=${actionable.date}`,
                kind: "primary",
              }
            : {
                label: "View gig",
                href: jobBase,
                kind: "waiting",
              };
      } else if (actionable?.reason === "today") {
        current = actionable.needs === "check_in" ? "check_in" : "check_out";
        statusText =
          actionable.needs === "check_in"
            ? "Ready to check in today"
            : "Checked in — ready to check out";
        if (input.actor === "freelancer") {
          cta = {
            label: actionable.needs === "check_in" ? "Check-In" : "Check-Out",
            href: `${jobBase}/${actionable.needs === "check_in" ? "check-in" : "check-out"}?date=${actionable.date}`,
            kind: "primary",
          };
        } else {
          cta = {
            label:
              actionable.needs === "check_in"
                ? "Generate check-in OTP"
                : "Generate check-out OTP",
            href: `${jobBase}/attendance?kind=${actionable.needs}&date=${actionable.date}`,
            kind: "primary",
          };
        }
      } else {
        // Future scheduled day
        const nextScheduled = days.find((d) => d.phase === "scheduled");
        current = "check_in";
        statusText = nextScheduled
          ? `Scheduled for ${nextScheduled.date}`
          : "Waiting for work day";
        cta = {
          label: "View gig",
          href: jobBase,
          kind: "waiting",
        };
      }
    } else if (input.paymentStatus !== "confirmed") {
      current = "payment";
      completedThrough = "check_out";
      if (input.paymentStatus === "dispute") {
        statusText = "Payment disputed";
        cta = {
          label: "Review dispute",
          href: `${jobBase}/payment`,
          kind: "primary",
        };
      } else if (input.actor === "business") {
        statusText = input.businessClaimed
          ? "Waiting for freelancer to confirm payment"
          : "Confirm payment";
        cta = input.businessClaimed
          ? {
              label: "View payment",
              href: `${jobBase}/payment`,
              kind: "waiting",
            }
          : {
              label: "Confirm payment",
              href: `${jobBase}/payment`,
              kind: "primary",
            };
      } else {
        statusText = input.freelancerClaimed
          ? "Waiting for business to confirm payment"
          : "Confirm you received payment";
        cta = input.freelancerClaimed
          ? {
              label: "View payment",
              href: `${jobBase}/payment`,
              kind: "waiting",
            }
          : {
              label: "Confirm payment",
              href: `${jobBase}/payment`,
              kind: "primary",
            };
      }
    } else if (!input.ratedByActor) {
      current = "rating";
      completedThrough = "payment";
      statusText =
        input.actor === "business" ? "Rate freelancer" : "Rate business";
      cta = {
        label: input.actor === "business" ? "Rate freelancer" : "Rate business",
        href: `${jobBase}/rate`,
        kind: "primary",
      };
    } else {
      completedThrough = "rating";
      statusText = "All steps complete";
      cta = {
        label: "View reviews",
        href: "/reviews",
        kind: "done",
      };
    }
  }

  // If check-in fully done but not check-out for progress detail
  if (
    input.applicationStatus === "accepted" &&
    checkInDone === totalDays &&
    !attendanceComplete &&
    current === "check_out"
  ) {
    completedThrough = "check_in";
  } else if (
    input.applicationStatus === "accepted" &&
    checkInDone > 0 &&
    current === "check_in"
  ) {
    // partial progress stays on check_in until all days checked in conceptually;
    // keep completedThrough at selected
  }

  const milestones: MilestoneView[] = (
    [
      "applied",
      "selected",
      "check_in",
      "check_out",
      "payment",
      "rating",
    ] as MilestoneId[]
  ).map((id) => {
    let detail: string | undefined;
    if (id === "check_in" && multi) detail = `${checkInDone}/${totalDays}`;
    if (id === "check_out" && multi) detail = `${checkOutDone}/${totalDays}`;
    if (id === "payment" && input.paymentStatus === "dispute") {
      detail = "Dispute";
    }
    return {
      id,
      label: MILESTONE_LABELS[id],
      state: milestoneState(id, current, completedThrough, exception),
      detail,
    };
  });

  // Block CTAs when job is not active for attendance/payment flows
  if (
    cta &&
    cta.kind === "primary" &&
    input.applicationStatus === "accepted" &&
    !ACTIVE_JOB.has(input.jobStatus) &&
    exception !== "job_cancelled"
  ) {
    cta = { ...cta, kind: "waiting", label: "Unavailable" };
  }

  return {
    applicationId: input.applicationId,
    jobId: input.jobId,
    actor: input.actor,
    applicationStatus: input.applicationStatus,
    exception,
    statusText,
    milestones,
    attendance: {
      totalDays,
      checkInDone,
      checkOutDone,
      days,
      actionable,
    },
    cta,
    paymentStatus: input.paymentStatus,
    businessClaimed: input.businessClaimed,
    freelancerClaimed: input.freelancerClaimed,
    ratedByActor: input.ratedByActor,
    attendanceComplete,
    selectionEditable,
  };
}

export type JobLifecycleSummary = {
  selected: number;
  attendanceComplete: number;
  paid: number;
  disputed: number;
  rated: number;
  headcount: number;
  applied: number;
  cta: LifecycleCTA;
  statusText: string;
};

export function summarizeJobLifecycles(
  jobId: string,
  headcount: number,
  jobStatus: JobStatus,
  lifecycles: ApplicationLifecycle[],
  appliedCount: number,
): JobLifecycleSummary {
  const accepted = lifecycles.filter((l) => l.applicationStatus === "accepted");
  const selected = accepted.length;
  const attendanceComplete = accepted.filter((l) => l.attendanceComplete).length;
  const paid = accepted.filter((l) => l.paymentStatus === "confirmed").length;
  const disputed = accepted.filter((l) => l.paymentStatus === "dispute").length;
  const rated = accepted.filter((l) => l.ratedByActor).length;

  let cta: LifecycleCTA = null;
  let statusText = "";

  const base = `/business/jobs/${jobId}`;

  if (SELECTION_OPEN.has(jobStatus) && appliedCount > 0 && selected < headcount) {
    statusText = `${appliedCount} waiting · ${selected}/${headcount} selected`;
    cta = {
      label: "Review applicants",
      href: `${base}/applicants`,
      kind: "primary",
    };
  } else {
    const priority = accepted.find(
      (l) =>
        l.cta?.kind === "primary" &&
        (l.exception === "missed_attendance" ||
          l.attendance.actionable?.reason === "today" ||
          l.exception === "payment_dispute" ||
          (!l.attendanceComplete && l.attendance.actionable) ||
          (l.attendanceComplete && l.paymentStatus !== "confirmed") ||
          (l.paymentStatus === "confirmed" && !l.ratedByActor)),
    );

    if (priority?.exception === "missed_attendance") {
      statusText = "Missed attendance needs correction";
      cta = priority.cta;
    } else if (
      priority?.attendance.actionable?.reason === "today" &&
      !priority.attendanceComplete
    ) {
      statusText = priority.statusText;
      cta = priority.cta;
    } else if (disputed > 0) {
      statusText = `${disputed} payment dispute${disputed > 1 ? "s" : ""}`;
      cta = {
        label: "Review disputes",
        href: `${base}/payment`,
        kind: "primary",
      };
    } else if (accepted.some((l) => l.attendanceComplete && l.paymentStatus !== "confirmed")) {
      statusText = "Payment pending";
      cta = {
        label: "Confirm payments",
        href: `${base}/payment`,
        kind: "primary",
      };
    } else if (accepted.some((l) => l.paymentStatus === "confirmed" && !l.ratedByActor)) {
      statusText = "Ratings pending";
      cta = {
        label: "Rate workers",
        href: `${base}/rate`,
        kind: "primary",
      };
    } else if (accepted.some((l) => !l.attendanceComplete && l.attendance.actionable?.reason === "today")) {
      statusText = "Attendance in progress";
      cta = {
        label: "Attendance",
        href: `${base}/attendance`,
        kind: "primary",
      };
    } else if (selected > 0 && SELECTION_OPEN.has(jobStatus)) {
      statusText = `${selected}/${headcount} selected`;
      cta = {
        label: "Manage",
        href: `${base}/applicants`,
        kind: "secondary",
      };
    } else if (selected > 0) {
      statusText = `${rated}/${selected} rated`;
      cta = {
        label: "View",
        href: `${base}/applicants`,
        kind: "secondary",
      };
    } else {
      statusText = "No workers selected";
      cta = {
        label: "View applicants",
        href: `${base}/applicants`,
        kind: "secondary",
      };
    }
  }

  return {
    selected,
    attendanceComplete,
    paid,
    disputed,
    rated,
    headcount,
    applied: appliedCount,
    cta,
    statusText,
  };
}
