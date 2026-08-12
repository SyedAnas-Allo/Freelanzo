"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/hooks/use-app-router";
import { toast } from "sonner";
import { refreshSessionProfile } from "@/hooks/use-session-profile";
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
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState<GenderType>("prefer_not_to_say");
  const [workType, setWorkType] = useState<WorkType>("unskilled");
  const [about, setAbout] = useState("");
  const [languages, setLanguages] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [photoUrl, setPhotoUrl] = useState("");
  const [location, setLocation] = useState<LocationValue>(defaultLocationValue());

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
        toast.error("Profile not found");
        router.push("/profile");
        return;
      }
      setProfileId(profile.id);
      setFullName(profile.full_name || "");
      setPhone((profile.phone || "").replace(/^\+91/, ""));
      setDob(profile.date_of_birth || "");
      setGender(profile.gender || "prefer_not_to_say");
      setWorkType(profile.work_type || "unskilled");
      setAbout(profile.about || "");
      setLanguages((profile.languages || []).join(", "));
      setSkills(profile.skills || []);
      setPhotoUrl(profile.photo_url || "");
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
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file");
      return;
    }
    if (file.size > 2.5 * 1024 * 1024) {
      toast.error("Keep photo under 2.5 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setPhotoUrl(reader.result);
    };
    reader.readAsDataURL(file);
  }

  async function save() {
    if (!profileId) return;
    const name = fullName.trim();
    if (!name) {
      toast.error("Enter your name");
      return;
    }
    const digits = phone.replace(/\D/g, "").slice(-10);
    if (digits.length !== 10) {
      toast.error("Enter a valid 10-digit mobile number");
      return;
    }
    if (!hasCoordinates(location)) {
      toast.error("Choose your current location or search for an area");
      return;
    }

    setSaving(true);
    const supabase = createClient();
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
        photo_url: photoUrl || null,
        area: location.area,
        city: location.city,
        lat: location.lat,
        lng: location.lng,
        search_radius_km: location.search_radius_km ?? 10,
        onboarding_complete: true,
      })
      .eq("id", profileId);

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile updated");
    await refreshSessionProfile();
    router.push(returnTo ?? "/profile");
  }

  return {
    loading,
    saving,
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
    photoUrl,
    setPhotoUrl,
    location,
    setLocation,
    pickAvatar,
    save,
    returnTo,
  };
}
