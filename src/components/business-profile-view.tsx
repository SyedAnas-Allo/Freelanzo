"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BadgeCheck,
  Briefcase,
  Calendar,
  MapPin,
  ShieldCheck,
  Star,
  UserRound,
  Users,
} from "lucide-react";
import { ExpandableText } from "@/components/expandable-text";
import { ScoreHelpHeader } from "@/components/info-help-sheet";
import { ReliabilityGauge } from "@/components/reliability-gauge";
import { BUSINESS_TRUST_HELP } from "@/lib/score-help";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { hasGstin } from "@/lib/gstin";
import {
  reliabilityLabel,
  reliabilityOutOfFive,
  yearsActiveSince,
  type BusinessProfileStats,
} from "@/lib/profile-stats";
import { CATEGORIES, cn } from "@/lib/utils";
import type { BusinessProfile } from "@/types/database";

const categoryLabel = (value: string) =>
  CATEGORIES.find((c) => c.value === value)?.label ?? value;

export function BusinessProfileView({
  business,
  location,
  stats,
  variant = "self",
  headerRight,
  footer,
  className,
}: {
  business: BusinessProfile;
  /** Area/city or address shown under the name */
  location?: string | null;
  stats: BusinessProfileStats;
  /** self = own profile; public = freelancer viewing business */
  variant?: "self" | "public";
  headerRight?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const [showAllCategories, setShowAllCategories] = useState(false);
  const categories = stats.categories;
  const shownCategories = showAllCategories
    ? categories
    : categories.slice(0, 4);
  const extraCategories = Math.max(0, categories.length - shownCategories.length);
  const experience = yearsActiveSince(business.created_at);
  const scoreOutOf5 = reliabilityOutOfFive(stats.reliability);
  const scoreLabel = reliabilityLabel(stats.reliability);
  const memberSince = new Date(business.created_at).toLocaleDateString(
    "en-IN",
    { month: "short", year: "numeric" },
  );
  const place =
    location?.trim() ||
    business.address?.trim() ||
    null;
  const reviewsHref = `/reviews/${business.owner_id}`;

  const metrics = [
    { label: "Gigs Posted", value: String(stats.jobsPosted) },
    { label: "Gigs Completed", value: String(stats.jobsCompleted) },
    { label: "Payment Rate", value: `${stats.paymentRate}%` },
    { label: "Cancel Rate", value: `${stats.cancelRate}%` },
  ];

  const about =
    business.description?.trim() ||
    (variant === "self"
      ? "Add a short description so freelancers know what you do."
      : "No description added yet.");

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <section className="relative">
        <div className="flex items-start gap-3">
          <Avatar className="size-20 shrink-0 border-2 border-primary/15 shadow-sm">
            <AvatarImage src={business.logo_url ?? undefined} />
            <AvatarFallback className="bg-primary/10 text-xl font-bold text-primary">
              {business.business_name.slice(0, 1)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1 pr-16">
            <div className="flex flex-wrap items-center gap-1.5">
              <h1 className="truncate text-lg font-extrabold tracking-tight">
                {business.business_name}
              </h1>
              {business.verified ? (
                <BadgeCheck className="size-4.5 shrink-0 fill-sky-500 text-white" />
              ) : null}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" size="sm" className="text-primary">
                Business
              </Badge>
              {business.verified ? (
                <Badge variant="info" size="sm">
                  Verified
                </Badge>
              ) : null}
              {hasGstin(business.gst_number) ? (
                <Badge variant="success" size="sm">
                  GST Registered
                </Badge>
              ) : null}
            </div>

            <ul className="mt-2.5 space-y-1 text-[11px] font-medium text-muted-foreground">
              {place ? (
                <li className="flex items-start gap-1.5">
                  <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  <span>{place}</span>
                </li>
              ) : null}
              {business.contact_person ? (
                <li className="flex items-center gap-1.5">
                  <UserRound className="size-3.5 shrink-0 text-primary" />
                  {business.contact_person}
                </li>
              ) : null}
            </ul>
          </div>
        </div>

        <div className="absolute top-0 right-0 flex flex-col items-end gap-2">
          {variant === "self" ? (
            <Link
              href="/business/edit"
              className="rounded-full border border-border/70 bg-card px-3 py-1.5 text-[11px] font-bold text-primary shadow-sm"
            >
              Edit
            </Link>
          ) : null}
          {stats.avgRating != null || stats.reviewCount > 0 ? (
            <Link
              href={reviewsHref}
              className="rounded-xl border border-border/70 bg-card px-2.5 py-2 text-center shadow-sm transition-colors hover:border-primary/40"
            >
              <div className="flex items-center justify-center gap-1">
                <Star className="size-3.5 fill-amber-400 text-amber-400" />
                <span className="text-sm font-extrabold">
                  {stats.avgRating != null ? stats.avgRating.toFixed(1) : "—"}
                </span>
              </div>
              <p className="text-[9px] font-medium text-muted-foreground">
                ({stats.reviewCount} Reviews)
              </p>
            </Link>
          ) : (
            <Link
              href={reviewsHref}
              className="rounded-xl border border-dashed border-border/70 bg-card px-2.5 py-2 text-center shadow-sm transition-colors hover:border-primary/40"
            >
              <div className="flex items-center justify-center gap-1">
                <Star className="size-3.5 text-muted-foreground" />
                <span className="text-sm font-extrabold">—</span>
              </div>
              <p className="text-[9px] font-medium text-muted-foreground">
                Reviews
              </p>
            </Link>
          )}
          {headerRight}
        </div>
      </section>

      {/* Metrics */}
      <section className="grid grid-cols-4 gap-1.5">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-xl border border-border/60 bg-card px-1.5 py-2.5 text-center"
          >
            <p className="text-base font-extrabold leading-none text-foreground">
              {m.value}
            </p>
            <p className="mt-1.5 text-[9px] leading-tight font-medium text-muted-foreground">
              {m.label}
            </p>
          </div>
        ))}
      </section>

      {/* About */}
      <section>
        <div className="mb-1.5 flex items-center justify-between">
          <h2 className="text-sm font-extrabold">About</h2>
        </div>
        <ExpandableText text={about} />
      </section>

      {/* Hiring categories */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-extrabold">Hiring Categories</h2>
          {categories.length > 4 ? (
            <button
              type="button"
              onClick={() => setShowAllCategories((visible) => !visible)}
              aria-expanded={showAllCategories}
              className="text-xs font-bold text-primary"
            >
              {showAllCategories ? "Show Less" : "View All"}
            </button>
          ) : null}
        </div>
        {categories.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {shownCategories.map((cat) => (
              <span
                key={cat}
                className="inline-flex items-center rounded-full border border-border/70 bg-card px-2.5 py-1 text-[11px] font-semibold"
              >
                {categoryLabel(cat)}
              </span>
            ))}
            {extraCategories > 0 ? (
              <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] font-bold text-primary">
                +{extraCategories} More
              </span>
            ) : null}
          </div>
        ) : (
          <p className="text-xs font-light text-muted-foreground">
            No gigs posted yet.
          </p>
        )}
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2.5">
            <Briefcase className="size-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-[10px] font-light text-muted-foreground">
                On Freelanzo
              </p>
              <p className="truncate text-xs font-bold">{experience}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2.5">
            <Users className="size-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-[10px] font-light text-muted-foreground">
                Freelancers Hired
              </p>
              <p className="truncate text-xs font-bold">
                {stats.freelancersHired}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust score */}
      <section className="rounded-2xl border border-border/70 bg-card p-4">
        <ScoreHelpHeader
          heading={variant === "self" ? "My Trust Score" : "Trust Score"}
          help={BUSINESS_TRUST_HELP}
        />
        <div className="flex items-center gap-4">
          <ReliabilityGauge
            score={stats.reliability}
            size="sm"
            label=""
            center={
              <div className="text-center">
                <p className="text-xl font-extrabold leading-none">
                  {scoreOutOf5.toFixed(1)}
                  <span className="text-xs font-semibold text-muted-foreground">
                    /5
                  </span>
                </p>
                <p className="mt-0.5 text-[10px] font-bold text-primary">
                  {scoreLabel}
                </p>
              </div>
            }
          />
          <ul className="min-w-0 flex-1 space-y-2.5">
            {metrics.map((m) => (
              <li
                key={m.label}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="font-medium text-muted-foreground">{m.label}</span>
                <span className="font-extrabold">{m.value}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-3 text-[10px] font-medium leading-relaxed text-muted-foreground">
          Based on payment confirmations, completed gigs, cancellations, and
          freelancer ratings.
        </p>
      </section>

      {/* Footer stats */}
      <section className="grid grid-cols-2 gap-2">
        <FooterStat
          icon={<Calendar className="size-4 text-primary" />}
          label="Member Since"
          value={memberSince}
        />
        <FooterStat
          icon={<Users className="size-4 text-primary" />}
          label="Freelancers Hired"
          value={String(stats.freelancersHired)}
        />
        <Link href={reviewsHref} className="block">
          <FooterStat
            icon={<Star className="size-4 text-primary" />}
            label="Avg Rating"
            value={stats.avgRating != null ? stats.avgRating.toFixed(1) : "—"}
          />
        </Link>
        <FooterStat
          icon={<Briefcase className="size-4 text-primary" />}
          label="Active Gigs"
          value={String(stats.activeGigs)}
        />
      </section>

      {business.verified || hasGstin(business.gst_number) ? (
        <section className="flex items-start gap-2 rounded-xl border border-border/60 bg-card px-3 py-2.5">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-sky-500" />
          <div className="min-w-0">
            <p className="text-xs font-bold">
              {business.verified
                ? "Verified on Freelanzo"
                : "GST details on file"}
            </p>
            <p className="text-[10px] font-medium text-muted-foreground">
              {business.verified
                ? "Identity and business details have been reviewed."
                : "This business has shared GST registration details."}
            </p>
          </div>
        </section>
      ) : null}

      {footer}
    </div>
  );
}

function FooterStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        {icon}
        <p className="text-[10px] font-light text-muted-foreground">{label}</p>
      </div>
      <p className="mt-1 text-sm font-extrabold">{value}</p>
    </div>
  );
}
