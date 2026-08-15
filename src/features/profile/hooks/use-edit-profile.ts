"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/hooks/use-app-router";
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
import type { GenderType, Profile, WorkType } from "@/types/database";

function safeReturnTo(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export function useEditProfile() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get("returnTo"));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<Profile["active_mode"] | null>(
    null,
  );
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState<GenderType>("prefer_not_to_say");
  const [workType, setWorkType] = useState<WorkType>("unskilled");
  const [about, setAbout] = useState("");
  const [languages, setLanguages] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const photoPreviewUrl = useMemo(
    () => (photoFile ? URL.createObjectURL(photoFile) : ""),
    [photoFile],
  );
  const [location, setLocation] = useState<LocationValue>(defaultLocationValue());

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [photoPreviewUrl]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) {
        router.push("/login");
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      const profile = data as Profile | null;
      if (!profile) {
        presentAppError(new Error("Profile not found"));
        router.push("/profile");
        return;
      }
      setProfileId(profile.id);
      setActiveMode(profile.active_mode);
      setFullName(profile.full_name || "");
      setPhone((profile.phone || "").replace(/^\+91/, ""));
      setDob(profile.date_of_birth || "");
      setGender(profile.gender || "prefer_not_to_say");
      setWorkType(profile.work_type || "unskilled");
      setAbout(profile.about || "");
      setLanguages((profile.languages || []).join(", "));
      setSkills(profile.skills || []);
      setPhotoUrl(
        profile.photo_url?.startsWith("data:") ? "" : profile.photo_url || "",
      );
      setLocation(
        defaultLocationValue({
          area: profile.area ?? undefined,
          city: profile.city ?? undefined,
          lat: profile.lat ?? undefined,
          lng: profile.lng ?? undefined,
          search_radius_km: profile.search_radius_km ?? undefined,
        }),
      );
      setLoading(false);
    }
    void load();
  }, [router]);

  function pickAvatar(file: File | null) {
    if (!file) return;
    const validationMessage = validateAvatarFile(file);
    if (validationMessage) {
      flashValidation(validationMessage);
      return;
    }
    setPhotoFile(file);
  }

  async function save() {
    if (!profileId) return;
    const name = fullName.trim();
    if (!name) {
      flashValidation("Enter your name");
      return;
    }
    const digits = phone.replace(/\D/g, "").slice(-10);
    if (digits.length !== 10) {
      flashValidation("Enter a valid 10-digit mobile number");
      return;
    }
    if (!hasCoordinates(location)) {
      flashValidation("Choose your current location or search for an area");
      return;
    }
    if (!ensureOnlineForMutation()) return;

    setSaving(true);
    const supabase = createClient();
    let uploadedPhoto: Awaited<ReturnType<typeof uploadPublicAvatar>> | null =
      null;
    try {
      if (photoFile) {
        uploadedPhoto = await uploadPublicAvatar({
          supabase,
          file: photoFile,
          ownerId: profileId,
          kind: "profiles",
        });
      }
    } catch (error) {
      setSaving(false);
      presentAppError(error, { op: "upload", onRetry: () => void save() });
      return;
    }

    const toList = (value: string) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: name,
        phone: `+91${digits}`,
        date_of_birth: dob || null,
        gender,
        work_type: workType,
        about: about.trim() || null,
        languages: toList(languages),
        skills,
        photo_url: (uploadedPhoto?.publicUrl ?? photoUrl) || null,
        area: location.area,
        city: location.city,
        lat: location.lat,
        lng: location.lng,
        search_radius_km: location.search_radius_km ?? null,
        onboarding_complete: true,
      })
      .eq("id", profileId);

    setSaving(false);
    if (error) {
      if (uploadedPhoto) {
        await removeAvatarObject(supabase, uploadedPhoto.path).catch(() => {});
      }
      presentAppError(error, { onRetry: () => void save() });
      return;
    }
    if (uploadedPhoto) {
      await removeReplacedOwnedAvatar({
        supabase,
        previousUrl: photoUrl,
        ownerId: profileId,
        replacementPath: uploadedPhoto.path,
      }).catch(() => {});
    }
    flashSuccess("Profile updated");
    await refreshSessionProfile();
    router.push(returnTo ?? "/profile");
  }

  return {
    loading,
    saving,
    activeMode,
    fullName,
    setFullName,
    phone,
    setPhone,
    dob,
    setDob,
    gender,
    setGender,
    workType,
    setWorkType,
    about,
    setAbout,
    languages,
    setLanguages,
    skills,
    setSkills,
    photoUrl: photoPreviewUrl || photoUrl,
    setPhotoUrl,
    location,
    setLocation,
    pickAvatar,
    save,
    returnTo,
  };
}
