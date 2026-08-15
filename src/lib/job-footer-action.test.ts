import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveJobFooterAction } from "./job-footer-action";

const findGigsCta = {
  label: "Find gigs",
  href: "/freelancer",
  kind: "secondary" as const,
};

describe("resolveJobFooterAction", () => {
  it("offers re-apply after a withdrawal instead of the withdrawn CTA", () => {
    const action = resolveJobFooterAction({
      applicationStatus: "cancelled",
      lifecycleCta: findGigsCta,
      closed: false,
    });
    assert.deepEqual(action, { kind: "reapply", label: "Apply Again" });
  });

  it("offers apply when there is no application", () => {
    const action = resolveJobFooterAction({
      applicationStatus: null,
      lifecycleCta: null,
      closed: false,
    });
    assert.deepEqual(action, { kind: "apply", label: "Apply Now" });
  });

  it("blocks re-apply once the gig stops accepting applications", () => {
    const action = resolveJobFooterAction({
      applicationStatus: "cancelled",
      lifecycleCta: findGigsCta,
      closed: true,
    });
    assert.deepEqual(action, { kind: "blocked", label: "Applications Closed" });
  });

  it("sends an incomplete profile to setup before re-applying", () => {
    const action = resolveJobFooterAction({
      applicationStatus: "cancelled",
      lifecycleCta: findGigsCta,
      closed: false,
      eligibilityBlock: {
        ok: false,
        code: "profile_incomplete",
        message: "Complete your profile to apply.",
        fixHref: "/onboarding?returnTo=%2Ffreelancer%2Fjobs%2Fjob-1",
      },
    });
    assert.deepEqual(action, {
      kind: "fix_profile",
      label: "Set Up Profile",
      href: "/onboarding?returnTo=%2Ffreelancer%2Fjobs%2Fjob-1",
    });
  });

  it("blocks re-apply on eligibility conflicts with no fix path", () => {
    const action = resolveJobFooterAction({
      applicationStatus: "cancelled",
      lifecycleCta: findGigsCta,
      closed: false,
      eligibilityBlock: {
        ok: false,
        code: "under_18",
        message: "You must be 18 or older to apply for gigs.",
      },
    });
    assert.deepEqual(action, { kind: "blocked", label: "Can't Apply" });
  });

  it("follows the lifecycle CTA for an active application", () => {
    const action = resolveJobFooterAction({
      applicationStatus: "accepted",
      lifecycleCta: {
        label: "Check-In",
        href: "/freelancer/jobs/job-1/check-in?date=2026-08-15",
        kind: "primary",
      },
      closed: true,
    });
    assert.deepEqual(action, {
      kind: "navigate",
      label: "Check-In",
      href: "/freelancer/jobs/job-1/check-in?date=2026-08-15",
    });
  });

  it("hides the footer for waiting states", () => {
    assert.deepEqual(
      resolveJobFooterAction({
        applicationStatus: "applied",
        lifecycleCta: {
          label: "Waiting for selection",
          href: "/freelancer/jobs/job-1",
          kind: "waiting",
        },
        closed: false,
      }),
      { kind: "hidden" },
    );
    assert.deepEqual(
      resolveJobFooterAction({
        applicationStatus: "rejected",
        lifecycleCta: null,
        closed: false,
      }),
      { kind: "hidden" },
    );
  });
});
