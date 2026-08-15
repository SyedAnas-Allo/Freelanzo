"use client";

import { useState } from "react";
import { useRouter } from "@/hooks/use-app-router";
import {
  ArrowRight,
  Briefcase,
  MapPin,
  Shield,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Logo } from "@/components/logo";
import {
  ensureOnlineForMutation,
  presentAppError,
} from "@/lib/flash-message";
import { setRoleReadyCookie } from "@/lib/role-session";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { UserMode } from "@/types/database";

export default function ContinuePage() {
  const router = useRouter();
  const [picking, setPicking] = useState<UserMode | null>(null);

  async function choose(mode: UserMode) {
    if (!ensureOnlineForMutation()) return;
    setPicking(mode);
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    if (!user) {
      router.push("/login");
      return;
    }

    // PostgREST returns no error when 0 rows match — require a returned row.
    const { data: updated, error } = await supabase
      .from("profiles")
      .update({ active_mode: mode })
      .eq("id", user.id)
      .select("active_mode")
      .maybeSingle();

    if (error) {
      setPicking(null);
      presentAppError(error, { onRetry: () => void choose(mode) });
      return;
    }

    if (!updated || updated.active_mode !== mode) {
      const meta = user.user_metadata ?? {};
      const fullName =
        (typeof meta.full_name === "string" ? meta.full_name : null) ??
        (typeof meta.name === "string" ? meta.name : null);
      const photoUrl =
        typeof meta.avatar_url === "string" ? meta.avatar_url : null;

      const { data: created, error: createError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: user.id,
            email: user.email ?? null,
            full_name: fullName,
            photo_url: photoUrl,
            active_mode: mode,
          },
          { onConflict: "id" },
        )
        .select("active_mode")
        .maybeSingle();

      if (createError || created?.active_mode !== mode) {
        setPicking(null);
        presentAppError(
          createError ?? new Error("Could not save your choice. Try again."),
          { onRetry: () => void choose(mode) },
        );
        return;
      }
    }

    setRoleReadyCookie(mode);
    // Hard navigate so (app) layout mounts with the saved mode. Soft push after
    // a refresh can preserve a freelancer shell while landing on /business.
    window.location.assign(mode === "business" ? "/business" : "/freelancer");
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-gradient-to-b from-white to-[#F8F2FF] px-5 pb-8 pt-8">
      <header className="text-center">
        <Logo size="md" href="/continue" className="justify-center" />
        <h1 className="mt-7 font-heading text-[1.65rem] font-extrabold leading-tight tracking-tight text-secondary-foreground">
          How would you like to continue?
        </h1>
        <p className="mx-auto mt-2 max-w-[28ch] text-sm font-light text-muted-foreground">
          Choose the option that best describes you to get started.
        </p>
      </header>

      <div className="mt-8 space-y-3">
        <RoleCard
          tone="business"
          eyebrow="I want to"
          title="Hire Freelancer"
          description="Find verified local freelancers for your temporary gigs."
          icon={<Briefcase className="size-5" />}
          disabled={picking !== null}
          loading={picking === "business"}
          onClick={() => void choose("business")}
        />
        <RoleCard
          tone="freelancer"
          eyebrow="I am a"
          title="Freelancer"
          description="Find nearby gigs and earn on your terms."
          icon={<UserRound className="size-5" />}
          disabled={picking !== null}
          loading={picking === "freelancer"}
          onClick={() => void choose("freelancer")}
        />
      </div>

      <div className="mt-auto flex items-start justify-between gap-2 pt-10 text-center">
        <TrustItem
          icon={<Shield className="size-3.5" />}
          label="Verified Businesses"
        />
        <TrustItem
          icon={<MapPin className="size-3.5" />}
          label="Nearby Opportunities"
        />
        <TrustItem
          icon={<ShieldCheck className="size-3.5" />}
          label="Safe & Secure"
        />
      </div>
    </div>
  );
}

function RoleCard({
  tone,
  eyebrow,
  title,
  description,
  icon,
  disabled,
  loading,
  onClick,
}: {
  tone: "business" | "freelancer";
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  const isBusiness = tone === "business";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border bg-white p-4 text-left shadow-sm transition active:scale-[0.99] disabled:opacity-70",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2",
        isBusiness ? "border-primary/12" : "border-success/15",
        loading && "opacity-80",
      )}
    >
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-full",
          isBusiness
            ? "bg-primary/10 text-primary"
            : "bg-success/10 text-success",
        )}
      >
        {icon}
      </span>

      <span className="min-w-0 flex-1 pr-1">
        <span className="block text-xs font-light text-muted-foreground">
          {eyebrow}
        </span>
        <span
          className={cn(
            "mt-0.5 block text-base font-extrabold uppercase tracking-wide",
            isBusiness ? "text-primary" : "text-success",
          )}
        >
          {loading ? "Opening…" : title}
        </span>
        <span className="mt-0.5 block text-xs font-light leading-snug text-muted-foreground">
          {description}
        </span>
      </span>

      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          isBusiness
            ? "bg-primary/10 text-primary"
            : "bg-success/10 text-success",
        )}
      >
        <ArrowRight className="size-4" />
      </span>
    </button>
  );
}

function TrustItem({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex w-[30%] flex-col items-center gap-1.5">
      <span className="flex size-8 items-center justify-center rounded-full bg-primary/8 text-primary">
        {icon}
      </span>
      <span className="text-[10px] font-medium leading-tight text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
