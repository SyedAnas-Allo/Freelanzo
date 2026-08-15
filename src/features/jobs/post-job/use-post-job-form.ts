"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "@/hooks/use-app-router";
import {
  SESSION_DRAFT_KEYS,
  useSessionDraft,
} from "@/hooks/use-session-draft";
import {
  flashValidation,
  presentAppError,
} from "@/lib/flash-message";
import {
  defaultLocationValue,
  hasCoordinates,
  type LocationValue,
} from "@/lib/locations";
import {
  getPostJobSetupGaps,
  postJobSetupHref,
  postJobSetupMessage,
} from "@/lib/profile-eligibility";
import {
  ensurePostJobDraftId,
  getPostJobDraftId,
} from "@/lib/post-job-draft";
import { createClient } from "@/lib/supabase/client";
import { formatTime } from "@/lib/utils";
import {
  addDaysISO,
  isJobScheduleOpen,
  localDateISO,
  parseLocalDate,
} from "@/lib/work-dates";
import type {
  JobCategory,
  JobGenderPreference,
} from "@/types/database";

const POST_JOB_PATH = "/business/jobs/new";

export const postJobTimeOptions = Array.from({ length: 48 }, (_, index) => {
  const hours = Math.floor(index / 2);
  const minutes = index % 2 === 0 ? "00" : "30";
  const value = `${String(hours).padStart(2, "0")}:${minutes}`;
  return { value, label: formatTime(value) };
});

const DEFAULT_START_TIME = "10:00";
const DEFAULT_END_TIME = "18:00";

export const SHIFT_ENDED_MESSAGE =
  "That shift has already ended — pick a later day or end time";

/** Today while its default shift can still run, otherwise tomorrow. */
function defaultWorkDate() {
  const today = localDateISO();
  return isJobScheduleOpen([today], DEFAULT_START_TIME, DEFAULT_END_TIME)
    ? today
    : addDaysISO(today, 1);
}

export type JobFormValues = {
  title: string;
  category: JobCategory | "";
  headcount: number;
  pay_per_freelancer: number;
  work_dates: string[];
  start_time: string;
  end_time: string;
  address: string;
  description: string;
  skilled: boolean;
  gender_preference: JobGenderPreference;
  instructions: string;
  dress_code: string;
  food_allowance_inr: number;
  travel_allowance_inr: number;
};

export type JobFormController = {
  form: JobFormValues;
  setForm: Dispatch<SetStateAction<JobFormValues>>;
  location: LocationValue | null;
  setLocation: Dispatch<SetStateAction<LocationValue | null>>;
  showDays: boolean;
  setShowDays: Dispatch<SetStateAction<boolean>>;
  showMap: boolean;
  setShowMap: Dispatch<SetStateAction<boolean>>;
  daysLabel: string;
  defaultLocation: typeof defaultLocationValue;
};

export function usePostJobForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useSessionDraft<LocationValue | null>(
    SESSION_DRAFT_KEYS.postJobLocation,
    null,
  );
  const [showDays, setShowDays] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [paymentAccepted, setPaymentAccepted] = useSessionDraft(
    SESSION_DRAFT_KEYS.postJobPaymentAccepted,
    true,
  );
  const [form, setForm] = useSessionDraft(
    SESSION_DRAFT_KEYS.postJobForm,
    () => ({
      title: "",
      category: "" as JobCategory | "",
      headcount: 1,
      pay_per_freelancer: 0,
      work_dates: [defaultWorkDate()] as string[],
      start_time: DEFAULT_START_TIME,
      end_time: DEFAULT_END_TIME,
      address: "",
      description: "",
      skilled: false,
      gender_preference: "any" as JobGenderPreference,
      instructions: "",
      dress_code: "",
      food_allowance_inr: 0,
      travel_allowance_inr: 0,
    }),
  );

  const postingFee = Math.max(0, form.headcount) * 50;
  const sortedDates = [...form.work_dates].sort();
  const daysLabel = sortedDates.length
    ? `${parseLocalDate(sortedDates[0]!).toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })}${sortedDates.length > 1 ? ` · ${sortedDates.length} days` : ""}`
    : "No days selected";

  async function continueToPay() {
    if (!form.title.trim()) {
      flashValidation("Enter a gig title");
      return;
    }
    if (!form.category) {
      flashValidation("Select a gig category");
      return;
    }
    if (form.work_dates.length === 0) {
      flashValidation("Select at least one work day");
      return;
    }
    if (
      !isJobScheduleOpen(form.work_dates, form.start_time, form.end_time)
    ) {
      flashValidation(SHIFT_ENDED_MESSAGE);
      setShowDays(true);
      return;
    }
    if (form.pay_per_freelancer <= 0) {
      flashValidation("Enter the base pay per day");
      return;
    }
    if (!location || !hasCoordinates(location)) {
      flashValidation("Choose a gig location");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    if (!user) {
      router.push("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("phone")
      .eq("id", user.id)
      .maybeSingle();
    const phoneGaps = getPostJobSetupGaps({
      phone: profile?.phone ?? null,
    });
    if (phoneGaps.length > 0) {
      setLoading(false);
      presentAppError({
        category: "eligibility",
        message: postJobSetupMessage(phoneGaps),
        retryable: false,
        action: { label: "Add phone", href: postJobSetupHref(POST_JOB_PATH) },
      });
      router.push(postJobSetupHref(POST_JOB_PATH));
      return;
    }

    const { data: business } = await supabase
      .from("business_profiles")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (!business) {
      setLoading(false);
      presentAppError({
        category: "eligibility",
        message: "Create a business profile first",
        retryable: false,
        action: {
          label: "Set up business",
          href: `/business/setup?returnTo=${encodeURIComponent(POST_JOB_PATH)}`,
        },
      });
      router.push(
        `/business/setup?returnTo=${encodeURIComponent(POST_JOB_PATH)}`,
      );
      return;
    }
    const { count } = await supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("business_id", business.id);

    const freeRemaining = Math.max(0, 2 - (count ?? 0));
    const workDates = [...form.work_dates].sort();
    let existingDraftId: string | null = null;
    try {
      const savedDraft = JSON.parse(
        sessionStorage.getItem("freelanzo_job_draft") ?? "null",
      ) as unknown;
      if (
        savedDraft &&
        typeof savedDraft === "object" &&
        "business_id" in savedDraft &&
        savedDraft.business_id === business.id
      ) {
        existingDraftId = getPostJobDraftId(savedDraft);
      }
    } catch {
      // A malformed legacy payment draft is replaced below.
    }

    sessionStorage.setItem(
      "freelanzo_job_draft",
      JSON.stringify(
        ensurePostJobDraftId({
          ...(existingDraftId ? { id: existingDraftId } : {}),
          business_id: business.id,
          ...form,
          job_date: workDates[0]!,
          work_dates: workDates,
          area: location.area,
          address: form.address || `${location.area}, ${location.city}`,
          city: location.city,
          lat: location.lat,
          lng: location.lng,
          instructions: form.instructions || null,
          dress_code: form.dress_code || null,
          food_allowance_inr: Math.max(0, form.food_allowance_inr),
          travel_allowance_inr: Math.max(0, form.travel_allowance_inr),
          fee: freeRemaining > 0 ? 0 : postingFee,
          freeRemaining,
          listFee: postingFee,
        }),
      ),
    );
    setLoading(false);
    router.push("/business/jobs/new/pay");
  }

  return {
    form,
    setForm,
    loading,
    location,
    setLocation,
    showDays,
    setShowDays,
    showMap,
    setShowMap,
    paymentAccepted,
    setPaymentAccepted,
    postingFee,
    daysLabel,
    defaultLocation: defaultLocationValue,
    continueToPay,
  };
}

export type PostJobFormController = ReturnType<typeof usePostJobForm>;
