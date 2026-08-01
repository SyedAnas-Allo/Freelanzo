"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/hooks/use-app-router";
import { toast } from "sonner";
import {
  defaultLocationValue,
  hasCoordinates,
  type LocationValue,
} from "@/lib/locations";
import { createClient } from "@/lib/supabase/client";
import type { GenderType, WorkType } from "@/types/database";

const STEP_COUNT = 3;

function safeReturnTo(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export function useOnboarding() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get("returnTo"));
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    date_of_birth: "",
    gender: "male" as GenderType,
    work_type: "unskilled" as WorkType,
    photo_url: "",
  });
  const [location, setLocation] = useState<LocationValue>(defaultLocationValue());

  useEffect(() => {
    async function hydrateFromProfile() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const meta = user.user_metadata ?? {};
      const { data: profile } = await supabase
        .from("profiles")
        .select(
          "full_name, phone, date_of_birth, gender, work_type, photo_url, area, city, lat, lng, search_radius_km",
        )
        .eq("id", user.id)
        .maybeSingle();

      setForm((current) => ({
        ...current,
        full_name:
          current.full_name ||
          profile?.full_name ||
          meta.full_name ||
          meta.name ||
          "",
        phone:
          current.phone ||
          (profile?.phone || "").replace(/^\+91/, "") ||
          "",
        date_of_birth: current.date_of_birth || profile?.date_of_birth || "",
        gender: (profile?.gender as GenderType) || current.gender,
        work_type: (profile?.work_type as WorkType) || current.work_type,
        photo_url:
          current.photo_url ||
          profile?.photo_url ||
          meta.avatar_url ||
          meta.picture ||
          "",
      }));

      if (profile?.lat != null && profile?.lng != null) {
        setLocation(
          defaultLocationValue({
            area: profile.area ?? undefined,
            city: profile.city ?? undefined,
            lat: profile.lat,
            lng: profile.lng,
            search_radius_km: profile.search_radius_km ?? undefined,
          }),
        );
      }
    }
    void hydrateFromProfile();
  }, []);

  const progress = useMemo(
    () => ((step + 1) / STEP_COUNT) * 100,
    [step],
  );

  function continueToNextStep() {
    if (step === 0 && !form.full_name.trim()) {
      toast.error("Please enter your name");
      return;
    }
    if (step === 0 && form.phone.replace(/\D/g, "").length < 10) {
      toast.error("Enter a valid 10-digit mobile number");
      return;
    }
    setStep((current) => current + 1);
  }

  async function finish() {
    if (!hasCoordinates(location)) {
      toast.error("Choose your current location or search for an area");
      setStep(1);
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please sign in again");
      router.push("/login");
      return;
    }
    const digits = form.phone.replace(/\D/g, "").slice(-10);
    const { error } = await supabase
      .from("profiles")
      .update({
        ...form,
        phone: digits.length === 10 ? `+91${digits}` : null,
        date_of_birth: form.date_of_birth || null,
        city: location.city,
        area: location.area,
        lat: location.lat,
        lng: location.lng,
        search_radius_km: location.search_radius_km ?? 10,
        photo_url: form.photo_url || null,
        onboarding_complete: true,
      })
      .eq("id", user.id);

    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("You're all set!");
    router.refresh();
    router.push(returnTo ?? "/continue");
  }

  return {
    step,
    stepCount: STEP_COUNT,
    loading,
    form,
    setForm,
    location,
    setLocation,
    progress,
    continueToNextStep,
    finish,
    returnTo,
  };
}
