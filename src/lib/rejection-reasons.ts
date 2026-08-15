export type RejectionReasonOption = {
  key: string;
  label: string;
};

/** Preset reasons for removing a selected freelancer. Other is always last. */
export const REJECTION_REASON_OPTIONS: RejectionReasonOption[] = [
  { key: "better_fit", label: "Found a better fit" },
  { key: "requirements_changed", label: "Role requirements changed" },
  { key: "headcount_reduced", label: "No longer need this opening" },
  { key: "availability", label: "Couldn't confirm their availability" },
  { key: "freelancer_cancelled", label: "Freelancer asked to cancel" },
  { key: "other", label: "Other" },
];

export function rejectionReasonRequiresDetails(reasonKey: string | null) {
  return reasonKey === "other";
}

/** Label stored on the application (preset label, or custom Other text). */
export function resolveRejectionReason(
  reasonKey: string | null,
  details: string,
): string | null {
  if (!reasonKey) return null;

  const option = REJECTION_REASON_OPTIONS.find((item) => item.key === reasonKey);
  if (!option) return null;

  if (option.key === "other") {
    const trimmed = details.trim();
    return trimmed ? trimmed : null;
  }

  return option.label;
}
