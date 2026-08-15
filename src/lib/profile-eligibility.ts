import { ageFromDob } from "@/lib/profile-stats";
import type {
  GenderType,
  Job,
  JobGenderPreference,
  Profile,
  WorkType,
} from "@/types/database";

export type EligibilityBlockCode =
  | "under_18"
  | "gender_mismatch"
  | "skilled_mismatch"
  | "profile_incomplete";

export type ProfileGapField =
  | "full_name"
  | "phone"
  | "location"
  | "date_of_birth"
  | "gender"
  | "photo_url";

export type EligibilityBlock = {
  ok: false;
  code: EligibilityBlockCode;
  message: string;
  /** Where to send the user to fix the conflict, if applicable. */
  fixHref?: string;
};

export type EligibilityOk = { ok: true };

export type EligibilityResult = EligibilityOk | EligibilityBlock;

export type ProfileGap = {
  field: ProfileGapField;
  label: string;
};

const GAP_LABELS: Record<ProfileGapField, string> = {
  full_name: "Full name",
  phone: "Mobile number",
  location: "Work location",
  date_of_birth: "Date of birth",
  gender: "Gender",
  photo_url: "Profile photo",
};

export function hasValidPhone(phone: string | null | undefined): boolean {
  return (phone ?? "").replace(/\D/g, "").slice(-10).length === 10;
}

function hasLocation(
  profile: Pick<Profile, "lat" | "lng">,
): boolean {
  return profile.lat != null && profile.lng != null;
}

function matchesGenderPreference(
  gender: GenderType | null | undefined,
  preference: JobGenderPreference,
): boolean {
  if (preference === "any") return true;
  return gender === preference;
}

/**
 * Essentials required before applying — deferred from signup onboarding.
 * Name, phone, and location so businesses can contact and match nearby.
 */
export function getApplySetupGaps(
  profile: Pick<
    Profile,
    "full_name" | "phone" | "lat" | "lng"
  >,
): ProfileGap[] {
  const gaps: ProfileGap[] = [];

  if (!profile.full_name?.trim()) {
    gaps.push({ field: "full_name", label: GAP_LABELS.full_name });
  }
  if (!hasValidPhone(profile.phone)) {
    gaps.push({ field: "phone", label: GAP_LABELS.phone });
  }
  if (!hasLocation(profile)) {
    gaps.push({ field: "location", label: GAP_LABELS.location });
  }

  return gaps;
}

export function profileNeedsApplySetup(
  profile: Pick<Profile, "full_name" | "phone" | "lat" | "lng">,
): boolean {
  return getApplySetupGaps(profile).length > 0;
}

export function applySetupHref(returnTo: string): string {
  return `/onboarding?returnTo=${encodeURIComponent(returnTo)}`;
}

/**
 * Mobile number required before posting — freelancers need a way to reach you.
 * Same phone rule as apply; name/location come from business setup + the gig form.
 */
export function getPostJobSetupGaps(
  profile: Pick<Profile, "phone">,
): ProfileGap[] {
  if (hasValidPhone(profile.phone)) return [];
  return [{ field: "phone", label: GAP_LABELS.phone }];
}

export function profileNeedsPostJobSetup(
  profile: Pick<Profile, "phone">,
): boolean {
  return getPostJobSetupGaps(profile).length > 0;
}

export function postJobSetupHref(returnTo: string): string {
  return `/onboarding?returnTo=${encodeURIComponent(returnTo)}`;
}

export function postJobSetupMessage(gaps: ProfileGap[]): string {
  const labels = gaps.map((g) => g.label).join(", ");
  return `Add your mobile number to post a gig — still needed: ${labels}.`;
}

/** Hard stops that prevent applying (conflicts + incomplete essentials). */
export function checkJobEligibility(
  profile: Pick<
    Profile,
    "full_name" | "phone" | "lat" | "lng" | "gender" | "date_of_birth" | "work_type"
  >,
  job: Pick<Job, "gender_preference" | "skilled">,
  options?: { editProfileHref?: string; setupHref?: string },
): EligibilityResult {
  const setupGaps = getApplySetupGaps(profile);
  if (setupGaps.length > 0) {
    const labels = setupGaps.map((g) => g.label).join(", ");
    return {
      ok: false,
      code: "profile_incomplete",
      message: `Complete your profile to apply — still needed: ${labels}.`,
      fixHref: options?.setupHref ?? options?.editProfileHref ?? "/onboarding",
    };
  }

  const editHref = options?.editProfileHref ?? "/profile/edit";

  const age = ageFromDob(profile.date_of_birth);
  if (age !== null && age < 18) {
    return {
      ok: false,
      code: "under_18",
      message:
        "You must be 18 or older to apply for gigs. You can still browse and update your profile.",
    };
  }

  if (
    job.gender_preference !== "any" &&
    profile.gender != null &&
    !matchesGenderPreference(profile.gender, job.gender_preference)
  ) {
    const wanted = job.gender_preference === "male" ? "male" : "female";
    return {
      ok: false,
      code: "gender_mismatch",
      message: `This gig prefers ${wanted} applicants. Update your profile gender if it is incorrect, or look for other gigs.`,
      fixHref: editHref,
    };
  }

  const workType = (profile.work_type ?? "unskilled") as WorkType;
  if (job.skilled && workType !== "skilled") {
    return {
      ok: false,
      code: "skilled_mismatch",
      message:
        "This gig needs skilled workers. Update your work type to Skilled in your profile if that fits you.",
      fixHref: editHref,
    };
  }

  return { ok: true };
}

/**
 * Soft gaps to nudge after a successful apply — keep the lead, then complete.
 * Only identity basics; about/skills/languages stay optional.
 */
export function getProfileGaps(
  profile: Pick<Profile, "date_of_birth" | "gender" | "photo_url">,
): ProfileGap[] {
  const gaps: ProfileGap[] = [];

  if (!profile.date_of_birth) {
    gaps.push({ field: "date_of_birth", label: GAP_LABELS.date_of_birth });
  }

  if (!profile.gender || profile.gender === "prefer_not_to_say") {
    gaps.push({ field: "gender", label: GAP_LABELS.gender });
  }

  if (!profile.photo_url) {
    gaps.push({ field: "photo_url", label: GAP_LABELS.photo_url });
  }

  return gaps;
}

export function profileNeedsCompletion(
  profile: Pick<Profile, "date_of_birth" | "gender" | "photo_url">,
): boolean {
  return getProfileGaps(profile).length > 0;
}

/** Map DB exception text to a freelancer-facing toast when possible. */
export function applyEligibilityErrorMessage(message: string): string | null {
  const stripped = message.replace(/^APPLICATION_ELIGIBILITY:\s*/i, "").trim();
  if (
    message.includes("must be 18 or older") ||
    stripped.includes("must be 18 or older")
  ) {
    return "You must be 18 or older to apply for gigs. You can still browse and update your profile.";
  }
  if (
    message.includes("APPLICATION_ELIGIBILITY:") ||
    message.includes("gender preference") ||
    message.includes("prefers") ||
    message.includes("skilled workers")
  ) {
    return stripped || message;
  }
  return null;
}
