"use client";

import Link from "next/link";
import { Suspense, useRef, useState } from "react";
import {
  Briefcase,
  Calendar,
  Camera,
  ChevronRight,
  Images,
  Languages,
  MapPin,
  Phone,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import { FormField } from "@/components/forms/form-field";
import { FormGroup } from "@/components/forms/form-group";
import { TagListInput } from "@/components/forms/tag-list-input";
import { PageContent } from "@/components/layout/page-content";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoading } from "@/components/page-loading";
import { formatSearchRadius } from "@/lib/locations";
import { LocationPickerLazy } from "@/components/location-picker-lazy";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useEditProfile } from "@/features/profile/hooks/use-edit-profile";
import type { GenderType, WorkType } from "@/types/database";

function EditProfileForm() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [showMap, setShowMap] = useState(false);
  const {
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
    photoUrl,
    location,
    setLocation,
    pickAvatar,
    save,
    returnTo,
  } = useEditProfile();

  if (loading) {
    return <PageLoading variant="form" />;
  }

  return (
    <PageContent className="pb-10">
      <PageHeader
        backHref={returnTo ?? "/profile"}
        title="Edit Profile"
        description="Update your name, photo, location, phone, and more."
      />

      <div className="flex flex-col items-center gap-2 py-2">
        <div className="relative">
          <Avatar className="size-24 border-2 border-primary/20">
            <AvatarImage src={photoUrl || undefined} />
            <AvatarFallback className="bg-primary/10 text-2xl font-bold text-primary">
              {(fullName || "?").slice(0, 1)}
            </AvatarFallback>
          </Avatar>
          <button
            type="button"
            aria-label="Change photo"
            className="absolute right-0 bottom-0 flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow"
            onClick={() => fileRef.current?.click()}
          >
            <Camera className="size-4" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pickAvatar(e.target.files?.[0] ?? null)}
          />
        </div>
        <button
          type="button"
          className="text-xs font-bold text-primary"
          onClick={() => fileRef.current?.click()}
        >
          {photoUrl ? "Change photo" : "Add photo"}
        </button>
      </div>

      {activeMode === "freelancer" ? (
        <Link
          href="/profile/photos?returnTo=%2Fprofile%2Fedit"
          className="mb-4 flex items-center gap-3 rounded-2xl border border-border/70 bg-card px-3.5 py-3.5 shadow-sm transition-colors hover:border-primary/30"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/8 text-primary">
            <Images className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">Profile Photos</span>
            <span className="block text-xs font-medium text-muted-foreground">
              Optional · Add and manage photos of your work
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      ) : null}

      <FormGroup>
        <FormField icon={UserRound} label="Full Name">
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name"
            className="h-auto border-0 bg-transparent p-0 text-[15px] font-bold shadow-none focus-visible:ring-0"
          />
        </FormField>

        <FormField icon={Phone} label="Mobile Number">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-bold">+91</span>
            <Input
              inputMode="numeric"
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="10-digit number"
              className="h-auto border-0 bg-transparent p-0 text-[15px] font-bold shadow-none focus-visible:ring-0"
            />
          </div>
        </FormField>

        <FormField icon={Calendar} label="Date of Birth">
          <Input
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="h-auto border-0 bg-transparent p-0 text-[15px] font-bold shadow-none focus-visible:ring-0"
          />
        </FormField>

        <FormField icon={Users} label="Gender">
          <Select
            value={gender}
            onValueChange={(v) => setGender(v as GenderType)}
          >
            <SelectTrigger className="h-auto w-full border-0 bg-transparent p-0 text-[15px] font-bold shadow-none focus-visible:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
              <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        <FormField icon={Briefcase} label="Work Type">
          <Select
            value={workType}
            onValueChange={(v) => setWorkType(v as WorkType)}
          >
            <SelectTrigger className="h-auto w-full border-0 bg-transparent p-0 text-[15px] font-bold shadow-none focus-visible:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unskilled">Unskilled / General</SelectItem>
              <SelectItem value="skilled">Skilled</SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        <FormField icon={Sparkles} label="About Me">
          <Textarea
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            rows={3}
            placeholder="Tell businesses about your experience…"
            className="min-h-20 resize-none border-0 bg-transparent p-0 text-sm font-medium shadow-none focus-visible:ring-0"
          />
        </FormField>

        <FormField icon={Languages} label="Languages">
          <Input
            value={languages}
            onChange={(e) => setLanguages(e.target.value)}
            placeholder="English, Hindi, Kannada"
            className="h-auto border-0 bg-transparent p-0 text-[15px] font-bold shadow-none focus-visible:ring-0"
          />
        </FormField>

        <FormField icon={Briefcase} label="Skills">
          <TagListInput
            value={skills}
            onChange={setSkills}
            placeholder="Type a skill and press Enter"
          />
        </FormField>

        <div className="px-3.5 py-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/8 text-primary">
                <MapPin className="size-3.5" />
              </span>
              <div>
                <p className="text-[11px] font-light text-muted-foreground">
                  Location
                </p>
                <p className="text-sm font-bold">
                  {[location.area, location.city].filter(Boolean).join(", ") ||
                    "Not selected"}
                  {location.lat !== null && location.lng !== null ? (
                    <span className="font-medium text-muted-foreground">
                      {" "}
                      · {formatSearchRadius(location.search_radius_km)}
                    </span>
                  ) : null}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-primary"
              onClick={() => setShowMap((v) => !v)}
            >
              {showMap ? "Hide" : "Change"}
            </Button>
          </div>
          {showMap ? (
            <div className="mt-3">
              <LocationPickerLazy value={location} onChange={setLocation} />
            </div>
          ) : null}
        </div>
      </FormGroup>

      <Button
        className="h-12 w-full rounded-xl"
        disabled={saving}
        onClick={save}
      >
        {saving ? "Saving…" : "Save changes"}
      </Button>
    </PageContent>
  );
}

export default function EditProfilePage() {
  return (
    <Suspense fallback={<PageLoading variant="form" />}>
      <EditProfileForm />
    </Suspense>
  );
}
