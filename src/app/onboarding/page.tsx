"use client";

import { Suspense, useRef } from "react";
import {
  ArrowRight,
  Briefcase,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronDown,
  MapPin,
  Phone,
  Shield,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { LocationPickerLazy } from "@/components/location-picker-lazy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOnboarding } from "@/features/onboarding/hooks/use-onboarding";
import { cn } from "@/lib/utils";
import type { GenderType, WorkType } from "@/types/database";

function FieldCard({
  icon: Icon,
  label,
  children,
  chevron,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
  chevron?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-primary/10 bg-card px-3.5 py-3 shadow-[0_2px_10px_rgba(40,20,80,0.03)]">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-light text-muted-foreground">{label}</p>
        <div className="mt-0.5">{children}</div>
      </div>
      {chevron ? (
        <ChevronDown className="size-4 shrink-0 text-primary/70" />
      ) : null}
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <OnboardingWizard />
    </Suspense>
  );
}

function OnboardingWizard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const {
    step,
    stepCount,
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
  } = useOnboarding();

  return (
    <div className="flex min-h-dvh flex-col bg-background px-5 pb-8 pt-6">
      {step > 0 && (
        <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {step === 0 && (
        <>
          <div className="mb-1">
            <div className="mb-4 flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1 flex-1 rounded-full",
                    i === 0 ? "bg-primary" : "bg-primary/15",
                  )}
                />
              ))}
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Set Up Your Profile
            </h1>
            <p className="mt-1 text-sm font-light text-muted-foreground">
              {returnTo?.includes("/business/jobs")
                ? "Add your mobile number so freelancers can reach you about this gig."
                : returnTo
                  ? "Add a few details so you can apply for this gig."
                  : "Add a few details to help businesses know more about you."}
            </p>
          </div>

          <div className="relative mx-auto my-6 size-28">
            <div className="flex size-28 items-center justify-center overflow-hidden rounded-full bg-secondary text-primary ring-4 ring-primary/10">
              {photoPreviewUrl || form.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoPreviewUrl || form.photo_url}
                  alt=""
                  className="size-28 rounded-full object-cover"
                />
              ) : (
                <span className="text-3xl font-bold">
                  {(form.full_name || "?").slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <button
              type="button"
              aria-label={
                photoPreviewUrl || form.photo_url ? "Change photo" : "Add photo"
              }
              className="absolute bottom-1 right-1 flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md"
              onClick={() => fileRef.current?.click()}
            >
              <Camera className="size-4" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                pickPhoto(event.target.files?.[0] ?? null);
                event.target.value = "";
              }}
            />
          </div>

          <div className="space-y-2.5">
            <FieldCard icon={UserRound} label="Full Name">
              <Input
                className="h-auto border-0 bg-transparent p-0 text-[15px] font-bold shadow-none focus-visible:ring-0"
                value={form.full_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, full_name: e.target.value }))
                }
                placeholder="Rahul Sharma"
              />
            </FieldCard>

            <FieldCard icon={Phone} label="Mobile Number">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-bold">+91</span>
                <Input
                  inputMode="numeric"
                  className="h-auto border-0 bg-transparent p-0 text-[15px] font-bold shadow-none focus-visible:ring-0"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  placeholder="10-digit number"
                  maxLength={10}
                />
              </div>
            </FieldCard>

            <FieldCard icon={Calendar} label="Date of Birth" chevron>
              <Input
                type="date"
                className="h-auto border-0 bg-transparent p-0 text-[15px] font-bold shadow-none focus-visible:ring-0"
                value={form.date_of_birth}
                onChange={(e) =>
                  setForm((f) => ({ ...f, date_of_birth: e.target.value }))
                }
              />
            </FieldCard>

            <FieldCard icon={Users} label="Gender" chevron>
              <Select
                value={form.gender}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, gender: v as GenderType }))
                }
              >
                <SelectTrigger className="h-auto w-full border-0 bg-transparent p-0 text-[15px] font-bold shadow-none focus-visible:ring-0 [&>svg]:hidden">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                  <SelectItem value="prefer_not_to_say">
                    Prefer not to say
                  </SelectItem>
                </SelectContent>
              </Select>
            </FieldCard>

            <FieldCard icon={Briefcase} label="Work Type" chevron>
              <Select
                value={form.work_type}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, work_type: v as WorkType }))
                }
              >
                <SelectTrigger className="h-auto w-full border-0 bg-transparent p-0 text-[15px] font-bold shadow-none focus-visible:ring-0 [&>svg]:hidden">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unskilled">Unskilled / General</SelectItem>
                  <SelectItem value="skilled">Skilled</SelectItem>
                </SelectContent>
              </Select>
            </FieldCard>

            <FieldCard icon={MapPin} label="Preferred Work Location" chevron>
              <p className="text-[15px] font-bold">
                {[location.area, location.city].filter(Boolean).join(", ") ||
                  "Not selected"}
              </p>
            </FieldCard>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <div className="mb-4 flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              2
            </span>
            <div>
              <h1 className="text-xl font-extrabold">Select Your Location</h1>
              <p className="text-sm font-light text-muted-foreground">
                Drop a pin — we&apos;ll show gigs nearby.
              </p>
            </div>
          </div>
          <LocationPickerLazy value={location} onChange={setLocation} />
        </>
      )}

      {step === 2 && (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="flex size-24 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <CheckCircle2 className="size-12" />
          </div>
          <h1 className="mt-6 text-2xl font-extrabold">You&apos;re All Set!</h1>
          <p className="mt-2 font-light text-muted-foreground">
            Let&apos;s get you started.
          </p>
          <ul className="mt-8 w-full space-y-3 text-left">
            {[
              {
                icon: Briefcase,
                title: "Find Local Gigs",
                body: "Explore gigs posted by trusted businesses nearby.",
              },
              {
                icon: Shield,
                title: "Safe & Secure",
                body: "Your safety and privacy are our top priority.",
              },
              {
                icon: Wallet,
                title: "Work. Connect. Earn.",
                body: "Flexible gigs and growth opportunities.",
              },
            ].map((item) => (
              <li
                key={item.title}
                className="flex gap-3 rounded-2xl border bg-card p-3"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                  <item.icon className="size-5" />
                </span>
                <div>
                  <p className="font-bold">{item.title}</p>
                  <p className="text-sm font-light text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-auto pt-6">
        {step < stepCount - 1 ? (
          <Button
            className="relative h-12 w-full rounded-xl text-base font-semibold"
            onClick={() => {
              continueToNextStep();
            }}
          >
            Continue
            <ArrowRight className="absolute right-4 size-4" />
          </Button>
        ) : (
          <Button
            className="h-12 w-full rounded-xl"
            disabled={loading}
            onClick={finish}
          >
            {returnTo ? "Save & Continue" : "Explore Gigs"}{" "}
            <ArrowRight className="size-4" />
          </Button>
        )}
        <div className="mt-4 flex justify-center gap-2">
          {Array.from({ length: stepCount }).map((_, i) => (
            <span
              key={i}
              className={`size-2 rounded-full ${i === step ? "bg-primary" : "bg-muted-foreground/30"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
