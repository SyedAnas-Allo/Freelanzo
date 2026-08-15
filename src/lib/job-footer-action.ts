import type { LifecycleCTA } from "@/lib/application-lifecycle";
import type { EligibilityBlock } from "@/lib/profile-eligibility";
import type { ApplicationStatus } from "@/types/database";

export type JobFooterAction =
  | { kind: "hidden" }
  | { kind: "navigate"; label: string; href: string }
  | { kind: "apply"; label: string }
  | { kind: "reapply"; label: string }
  | { kind: "fix_profile"; label: string; href: string }
  | { kind: "blocked"; label: string };

/** No application yet, or a withdrawn one that can be revived. */
export function canApplyOrReapply(
  status: ApplicationStatus | null | undefined,
): boolean {
  return status == null || status === "cancelled";
}

/**
 * Which action the freelancer job detail footer offers.
 *
 * Applying outranks the lifecycle CTA: a withdrawn application still carries a
 * "Find gigs" CTA, and letting that win sends the freelancer to the gig list
 * instead of letting them re-apply to the gig they are looking at.
 */
export function resolveJobFooterAction({
  applicationStatus,
  lifecycleCta,
  closed,
  eligibilityBlock,
}: {
  applicationStatus: ApplicationStatus | null | undefined;
  lifecycleCta: LifecycleCTA;
  closed: boolean;
  eligibilityBlock?: EligibilityBlock | null;
}): JobFooterAction {
  if (canApplyOrReapply(applicationStatus)) {
    const reapply = applicationStatus === "cancelled";

    if (closed) return { kind: "blocked", label: "Applications Closed" };

    if (eligibilityBlock) {
      if (
        eligibilityBlock.code === "profile_incomplete" &&
        eligibilityBlock.fixHref
      ) {
        return {
          kind: "fix_profile",
          label: "Set Up Profile",
          href: eligibilityBlock.fixHref,
        };
      }
      return { kind: "blocked", label: "Can't Apply" };
    }

    return reapply
      ? { kind: "reapply", label: "Apply Again" }
      : { kind: "apply", label: "Apply Now" };
  }

  if (
    lifecycleCta &&
    (lifecycleCta.kind === "primary" || lifecycleCta.kind === "secondary")
  ) {
    return {
      kind: "navigate",
      label: lifecycleCta.label,
      href: lifecycleCta.href,
    };
  }

  // Applied / rejected / selected waiting states — status lives in the
  // lifecycle tracker; do not render a fake disabled swipe CTA.
  return { kind: "hidden" };
}
