"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  defaultLocationValue,
  hasCoordinates,
  type LocationValue,
} from "@/lib/locations";
import { createClient } from "@/lib/supabase/client";
import { formatTime } from "@/lib/utils";
import { localDateISO, parseLocalDate } from "@/lib/work-dates";
import type {
  JobCategory,
  JobGenderPreference,
} from "@/types/database";

export const postJobTimeOptions = Array.from({ length: 48 }, (_, index) => {
  const hours = Math.floor(index / 2);
  const minutes = index % 2 === 0 ? "00" : "30";
  const value = `${String(hours).padStart(2, "0")}:${minutes}`;
  return { value, label: formatTime(value) };
});

export function usePostJobForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [showDays, setShowDays] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [paymentAccepted, setPaymentAccepted] = useState(true);
  const [form, setForm] = useState({
    title: "",
    category: "" as JobCategory | "",
    headcount: 1,
    pay_per_freelancer: 0,
    work_dates: [localDateISO()] as string[],
    start_time: "10:00",
    end_time: "18:00",
    address: "",
    description: "",
    skilled: false,
    gender_preference: "any" as JobGenderPreference,
    instructions: "",
    dress_code: "",
    food_allowance_inr: 0,
    travel_allowance_inr: 0,
  });

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
      toast.error("Enter a gig title");
      return;
    }
    if (!form.category) {
      toast.error("Select a gig category");
      return;
    }
    if (form.work_dates.length === 0) {
      toast.error("Select at least one work day");
      return;
    }
    if (form.pay_per_freelancer <= 0) {
      toast.error("Enter the base pay per day");
      return;
    }
    if (!location || !hasCoordinates(location)) {
      toast.error("Choose a gig location");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    const { data: business } = await supabase
      .from("business_profiles")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (!business) {
      setLoading(false);
      toast.error("Create a business profile first");
      router.push(
        `/business/setup?returnTo=${encodeURIComponent("/business/jobs/new")}`,
      );
      return;
    }
    const { count } = await supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("business_id", business.id);

    const freeRemaining = Math.max(0, 2 - (count ?? 0));
    const workDates = [...form.work_dates].sort();
    sessionStorage.setItem(
      "freelanzo_job_draft",
      JSON.stringify({
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
