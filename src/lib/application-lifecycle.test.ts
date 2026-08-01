import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyAttendanceDays,
  deriveApplicationLifecycle,
  nextActionableAttendance,
  summarizeJobLifecycles,
} from "./application-lifecycle";

describe("classifyAttendanceDays", () => {
  it("marks future incomplete days as scheduled", () => {
    const days = classifyAttendanceDays(
      ["2026-07-30", "2026-07-31", "2026-08-01"],
      [{ kind: "check_in", work_date: "2026-07-30" }],
      "2026-07-30",
    );
    assert.equal(days[0]!.phase, "today_check_out");
    assert.equal(days[1]!.phase, "scheduled");
    assert.equal(days[2]!.phase, "scheduled");
  });

  it("marks past incomplete days as missed", () => {
    const days = classifyAttendanceDays(
      ["2026-07-28", "2026-07-29"],
      [],
      "2026-07-30",
    );
    assert.equal(days[0]!.phase, "missed");
    assert.equal(days[1]!.phase, "missed");
  });
});

describe("nextActionableAttendance", () => {
  it("prefers missed over today", () => {
    const days = classifyAttendanceDays(
      ["2026-07-29", "2026-07-30"],
      [],
      "2026-07-30",
    );
    const next = nextActionableAttendance(days);
    assert.deepEqual(next, {
      date: "2026-07-29",
      needs: "check_in",
      reason: "missed",
    });
  });

  it("returns null for only future days", () => {
    const days = classifyAttendanceDays(["2026-08-05"], [], "2026-07-30");
    assert.equal(nextActionableAttendance(days), null);
  });
});

describe("deriveApplicationLifecycle", () => {
  const base = {
    applicationId: "app-1",
    jobId: "job-1",
    jobStatus: "in_progress" as const,
    workDates: ["2026-07-30"],
    events: [] as { kind: string; work_date: string }[],
    paymentStatus: null as null,
    businessClaimed: false,
    freelancerClaimed: false,
    ratedByActor: false,
    headcount: 1,
    acceptedCount: 1,
    today: "2026-07-30",
  };

  it("shows waiting selection for applied freelancer", () => {
    const life = deriveApplicationLifecycle({
      ...base,
      applicationStatus: "applied",
      actor: "freelancer",
    });
    assert.equal(life.milestones.find((m) => m.id === "applied")?.state, "completed");
    assert.equal(life.milestones.find((m) => m.id === "selected")?.state, "current");
    assert.equal(life.cta?.kind, "waiting");
  });

  it("offers check-in only when today needs it", () => {
    const life = deriveApplicationLifecycle({
      ...base,
      applicationStatus: "accepted",
      actor: "freelancer",
    });
    assert.equal(life.cta?.label, "Check-In");
    assert.match(life.cta!.href, /check-in/);
    assert.equal(life.milestones.find((m) => m.id === "check_in")?.state, "current");
    assert.equal(life.milestones.find((m) => m.id === "check_out")?.state, "upcoming");
  });

  it("does not offer check-in after already checked in", () => {
    const life = deriveApplicationLifecycle({
      ...base,
      applicationStatus: "accepted",
      actor: "freelancer",
      events: [{ kind: "check_in", work_date: "2026-07-30" }],
    });
    assert.equal(life.cta?.label, "Check-Out");
    assert.equal(life.milestones.find((m) => m.id === "check_in")?.state, "completed");
  });

  it("blocks payment until attendance complete", () => {
    const life = deriveApplicationLifecycle({
      ...base,
      applicationStatus: "accepted",
      actor: "business",
      workDates: ["2026-07-30", "2026-07-31"],
      events: [
        { kind: "check_in", work_date: "2026-07-30" },
        { kind: "check_out", work_date: "2026-07-30" },
      ],
    });
    assert.equal(life.attendanceComplete, false);
    assert.notEqual(life.cta?.label, "Confirm payment");
    assert.equal(
      life.statusText.includes("Scheduled") || life.cta?.kind === "waiting",
      true,
    );
  });

  it("flags missed attendance for business correction", () => {
    const life = deriveApplicationLifecycle({
      ...base,
      applicationStatus: "accepted",
      actor: "business",
      today: "2026-07-31",
      workDates: ["2026-07-30"],
    });
    assert.equal(life.exception, "missed_attendance");
    assert.equal(life.cta?.label, "Correct attendance");
  });

  it("offers payment after full attendance", () => {
    const life = deriveApplicationLifecycle({
      ...base,
      applicationStatus: "accepted",
      actor: "freelancer",
      events: [
        { kind: "check_in", work_date: "2026-07-30" },
        { kind: "check_out", work_date: "2026-07-30" },
      ],
    });
    assert.equal(life.attendanceComplete, true);
    assert.equal(life.cta?.label, "Confirm payment");
  });

  it("treats dispute as exception and blocks rating CTA", () => {
    const life = deriveApplicationLifecycle({
      ...base,
      applicationStatus: "accepted",
      actor: "freelancer",
      events: [
        { kind: "check_in", work_date: "2026-07-30" },
        { kind: "check_out", work_date: "2026-07-30" },
      ],
      paymentStatus: "dispute",
      businessClaimed: true,
      freelancerClaimed: true,
    });
    assert.equal(life.exception, "payment_dispute");
    assert.equal(life.milestones.find((m) => m.id === "payment")?.state, "exception");
    assert.equal(life.cta?.label, "Review dispute");
  });

  it("offers rating only after confirmed payment", () => {
    const life = deriveApplicationLifecycle({
      ...base,
      applicationStatus: "accepted",
      actor: "business",
      events: [
        { kind: "check_in", work_date: "2026-07-30" },
        { kind: "check_out", work_date: "2026-07-30" },
      ],
      paymentStatus: "confirmed",
      businessClaimed: true,
      freelancerClaimed: true,
    });
    assert.equal(life.cta?.label, "Rate freelancer");
  });

  it("marks rejected as exception", () => {
    const life = deriveApplicationLifecycle({
      ...base,
      applicationStatus: "rejected",
      actor: "freelancer",
    });
    assert.equal(life.exception, "rejected");
    assert.equal(life.statusText, "Not selected");
  });
});

describe("summarizeJobLifecycles", () => {
  it("prioritizes applicant review when slots remain", () => {
    const life = deriveApplicationLifecycle({
      applicationId: "a1",
      jobId: "j1",
      applicationStatus: "applied",
      jobStatus: "live",
      workDates: ["2026-07-30"],
      events: [],
      paymentStatus: null,
      businessClaimed: false,
      freelancerClaimed: false,
      ratedByActor: false,
      headcount: 2,
      acceptedCount: 0,
      actor: "business",
      today: "2026-07-30",
    });
    const summary = summarizeJobLifecycles("j1", 2, "live", [life], 1);
    assert.equal(summary.cta?.label, "Review applicants");
  });
});
