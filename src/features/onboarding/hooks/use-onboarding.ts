"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/hooks/use-app-router";
import {
  clearSessionDraft,
  SESSION_DRAFT_KEYS,
  useSessionDraft,
} from "@/hooks/use-session-draft";
import { refreshSessionProfile } from "@/hooks/use-session-profile";
import {
  ensureOnlineForMutation,
  flashSuccess,
  flashValidation,
  presentAppError,
} from "@/lib/flash-message";
import {
  removeAvatarObject,
  removeReplacedOwnedAvatar,
  uploadPublicAvatar,
  validateAvatarFile,
} from "@/lib/avatar-upload";
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
  const [step, setStep] = useSessionDraft(
    SESSION_DRAFT_KEYS.onboardingStep,
    0,
  );
  const [loading, setLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const photoPreviewUrl = useMemo(
    () => (photoFile ? URL.createObjectURL(photoFile) : ""),
    [photoFile],
  );
  const [form, setForm] = useSessionDraft(SESSION_DRAFT_KEYS.onboardingForm, {
    full_name: "",
    phone: "",
    date_of_birth: "",
    gender: "male" as GenderType,
    work_type: "unskilled" as WorkType,
    photo_url: "",
  });
  const [location, setLocation] = useSessionDraft<LocationValue>(
    SESSION_DRAFT_KEYS.onboardingLocation,
    defaultLocationValue,
  );

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [photoPreviewUrl]);

  useEffect(() => {
    async function hydrateFromProfile() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user ?? null;
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
          (current.photo_url.startsWith("data:") ? "" : current.photo_url) ||
          profile?.photo_url ||
          meta.avatar_url ||
          meta.picture ||
          "",
      }));

      if (profile?.lat != null && profile?.lng != null) {
        setLocation((current) =>
          hasCoordinates(current)
            ? current
            : defaultLocationValue({
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
  }, [setForm, setLocation]);

  const progress = useMemo(
    () => ((step + 1) / STEP_COUNT) * 100,
    [step],
  );

  function continueToNextStep() {
    if (step === 0 && !form.full_name.trim()) {
      flashValidation("Please enter your name");
      return;
    }
    if (step === 0 && form.phone.replace(/\D/g, "").length < 10) {
      flashValidation("Enter a valid 10-digit mobile number");
      return;
    }
    setStep((current) => current + 1);
  }

  function pickPhoto(file: File | null) {
    if (!file) return;
    const validationMessage = validateAvatarFile(file);
    if (validationMessage) {
      flashValidation(validationMessage);
      return;
    }
    setPhotoFile(file);
  }

  async function finish() {
    if (!hasCoordinates(location)) {
      flashValidation("Choose your current location or search for an area");
      setStep(1);
      return;
    }
    if (!ensureOnlineForMutation()) return;
    setLoading(true);
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    if (!user) {
      setLoading(false);
      presentAppError(new Error("Not authenticated"));
      router.push("/login");
      return;
    }
    const digits = form.phone.replace(/\D/g, "").slice(-10);
    const previousPhotoUrl = form.photo_url.startsWith("data:")
      ? null
      : form.photo_url || null;
    let uploadedPhoto: Awaited<ReturnType<typeof uploadPublicAvatar>> | null =
      null;

    try {
      if (photoFile) {
        uploadedPhoto = await uploadPublicAvatar({
          supabase,
          file: photoFile,
          ownerId: user.id,
          kind: "profiles",
        });
      }
    } catch (error) {
      setLoading(false);
      presentAppError(error, { op: "upload", onRetry: () => void finish() });
      return;
    }

    const nextPhotoUrl = uploadedPhoto?.publicUrl ?? previousPhotoUrl;
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
        search_radius_km: location.search_radius_km ?? null,
        photo_url: nextPhotoUrl,
        onboarding_complete: true,
      })
      .eq("id", user.id);

    setLoading(false);
    if (error) {
      if (uploadedPhoto) {
        await removeAvatarObject(supabase, uploadedPhoto.path).catch(() => {});
      }
      presentAppError(error, { onRetry: () => void finish() });
      return;
    }
    if (uploadedPhoto) {
      await removeReplacedOwnedAvatar({
        supabase,
        previousUrl: previousPhotoUrl,
        ownerId: user.id,
        replacementPath: uploadedPhoto.path,
      }).catch(() => {});
    }
    flashSuccess("You're all set!");
    clearSessionDraft(
      SESSION_DRAFT_KEYS.onboardingForm,
      SESSION_DRAFT_KEYS.onboardingLocation,
      SESSION_DRAFT_KEYS.onboardingStep,
    );
    await refreshSessionProfile();
    router.push(returnTo ?? "/continue");
  }

  return {
    step,
    stepCount: STEP_COUNT,
    loading,
    form,
    setForm,
    photoPreviewUrl,
    pickPhoto,
    location,
    setLocation,
    progress,
    continueToNextStep,
    finish,
    returnTo,
  };
}
