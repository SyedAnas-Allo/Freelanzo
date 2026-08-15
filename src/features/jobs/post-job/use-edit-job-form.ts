"use client";

import { useState } from "react";
import { useRouter } from "@/hooks/use-app-router";
import {
  ensureOnlineForMutation,
  flashSuccess,
  flashValidation,
  presentAppError,
} from "@/lib/flash-message";
import {
  defaultLocationValue,
  hasCoordinates,
  type LocationValue,
} from "@/lib/locations";
import { createClient } from "@/lib/supabase/client";
import { isJobScheduleOpen, parseLocalDate } from "@/lib/work-dates";
import type { Job } from "@/types/database";
import {
  SHIFT_ENDED_MESSAGE,
  type JobFormController,
  type JobFormValues,
} from "./use-post-job-form";

export function useEditJobForm(job: Job) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showDays, setShowDays] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [location, setLocation] = useState<LocationValue | null>(() =>
    defaultLocationValue({
      area: job.area ?? "",
      city: job.city,
      lat: job.lat,
      lng: job.lng,
    }),
  );
  const [form, setForm] = useState<JobFormValues>(() => ({
    title: job.title,
    category: job.category,
    headcount: job.headcount,
    pay_per_freelancer: job.pay_per_freelancer,
    work_dates: job.work_dates?.length ? job.work_dates : [job.job_date],
    start_time: job.start_time.slice(0, 5),
    end_time: job.end_time.slice(0, 5),
    address: job.address,
    description: job.description ?? "",
    skilled: job.skilled,
    gender_preference: job.gender_preference,
    instructions: job.instructions ?? "",
    dress_code: job.dress_code ?? "",
    food_allowance_inr: job.food_allowance_inr,
    travel_allowance_inr: job.travel_allowance_inr,
  }));

  const scheduleLocked = job.active_application_count > 0;
  const sortedDates = [...form.work_dates].sort();
  const daysLabel = sortedDates.length
    ? `${parseLocalDate(sortedDates[0]!).toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })}${sortedDates.length > 1 ? ` · ${sortedDates.length} days` : ""}`
    : "No days selected";

  async function save() {
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
      !scheduleLocked &&
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
    if (!ensureOnlineForMutation()) return;

    setLoading(true);
    const workDates = [...form.work_dates].sort();
    const supabase = createClient();
    const { error } = await supabase.rpc("update_job_and_notify_applicants", {
      p_job_id: job.id,
      p_title: form.title,
      p_description: form.description,
      p_category: form.category,
      p_skilled: form.skilled,
      p_gender_preference: form.gender_preference,
      p_headcount: form.headcount,
      p_work_dates: workDates,
      p_start_time: form.start_time,
      p_end_time: form.end_time,
      p_address:
        form.address.trim() ||
        [location.area, location.city].filter(Boolean).join(", "),
      p_area: location.area,
      p_city: location.city,
      p_lat: location.lat,
      p_lng: location.lng,
      p_pay_per_freelancer: form.pay_per_freelancer,
      p_dress_code: form.dress_code,
      p_instructions: form.instructions,
      p_food_allowance_inr: Math.max(0, form.food_allowance_inr),
      p_travel_allowance_inr: Math.max(0, form.travel_allowance_inr),
    });
    setLoading(false);

    if (error) {
      presentAppError(error, { onRetry: () => void save() });
      return;
    }

    flashSuccess(
      scheduleLocked ? "Gig updated and freelancers notified" : "Gig updated",
    );
    router.push(`/business/jobs/${job.id}/applicants`);
    router.refresh();
  }

  const controller: JobFormController = {
    form,
    setForm,
    location,
    setLocation,
    showDays,
    setShowDays,
    showMap,
    setShowMap,
    daysLabel,
    defaultLocation: defaultLocationValue,
  };

  return { controller, loading, scheduleLocked, save };
}
