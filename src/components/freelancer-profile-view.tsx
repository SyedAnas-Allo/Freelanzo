"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BadgeCheck,
  Briefcase,
  Calendar,
  GraduationCap,
  Info,
  Languages,
  MapPin,
  Star,
  User,
  VenusAndMars,
  Wallet,
} from "lucide-react";
import { ExpandableText } from "@/components/expandable-text";
import { ReliabilityGauge } from "@/components/reliability-gauge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  ageFromDob,
  reliabilityLabel,
  reliabilityOutOfFive,
  yearsActiveSince,
  type FreelancerProfileStats,
} from "@/lib/profile-stats";
import { cn, formatPay } from "@/lib/utils";
import type { Profile } from "@/types/database";

export function FreelancerProfileView({
  profile,
  stats,
  workPhotos,
  variant = "self",
  headerRight,
  footer,
  className,
}: {
  profile: Profile;
  stats: FreelancerProfileStats;
  workPhotos: string[];
  /** self = own profile; public = business viewing applicant */
  variant?: "self" | "public";
  headerRight?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const [showAllSkills, setShowAllSkills] = useState(false);
  const age = ageFromDob(profile.date_of_birth);
  const location = [profile.area, profile.city].filter(Boolean).join(", ");
  const radius = profile.search_radius_km ?? 10;
  const skills = profile.skills ?? [];
  const languages = profile.languages ?? [];
  const shownSkills = showAllSkills ? skills : skills.slice(0, 4);
  const extraSkills = Math.max(0, skills.length - shownSkills.length);
  const experience = yearsActiveSince(profile.created_at);
  const workTypeLabel =
    profile.work_type === "skilled"
      ? "Skilled"
      : profile.work_type === "unskilled"
        ? "Unskilled / General"
        : "General";
  const genderLabel =
    profile.gender && profile.gender !== "prefer_not_to_say"
      ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1)
      : null;
  const scoreOutOf5 = reliabilityOutOfFive(stats.reliability);
  const scoreLabel = reliabilityLabel(stats.reliability);
  const memberSince = new Date(profile.created_at).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });
  const reviewsHref = `/reviews/${profile.id}`;

  const metrics = [
    { label: "Gigs Completed", value: String(stats.jobsCompleted) },
    { label: "Attendance Rate", value: `${stats.attendanceRate}%` },
    { label: "Cancellation Rate", value: `${stats.cancellationRate}%` },
    { label: "No-Show Rate", value: `${stats.noShowRate}%` },
  ];

  const about =
    profile.about?.trim() ||
    (variant === "self"
      ? "Add a short bio so businesses know what you’re great at."
      : "No bio added yet.");

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <section className="relative">
        <div className="flex items-start gap-3">
          <Avatar className="size-20 shrink-0 border-2 border-primary/15 shadow-sm">
            <AvatarImage src={profile.photo_url ?? undefined} />
            <AvatarFallback className="bg-primary/10 text-xl font-bold text-primary">
              {(profile.full_name || "?").slice(0, 1)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1 pr-16">
            <div className="flex flex-wrap items-center gap-1.5">
              <h1 className="truncate text-lg font-extrabold tracking-tight">
                {profile.full_name || "Freelancer"}
              </h1>
              <BadgeCheck className="size-4.5 shrink-0 fill-primary text-white" />
            </div>
            <Badge variant="secondary" size="sm" className="mt-1 text-primary">
              Freelancer
            </Badge>

            <ul className="mt-2.5 space-y-1 text-[11px] font-medium text-muted-foreground">
              {location ? (
                <li className="flex items-start gap-1.5">
                  <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  <span>
                    {location}
                    <span className="text-muted-foreground/80">
                      {" "}
                      · Within {radius} km
                    </span>
                  </span>
                </li>
              ) : null}
              {age != null ? (
                <li className="flex items-center gap-1.5">
                  <User className="size-3.5 shrink-0 text-primary" />
                  {age} Years
                </li>
              ) : null}
              {genderLabel ? (
                <li className="flex items-center gap-1.5">
                  <VenusAndMars className="size-3.5 shrink-0 text-primary" />
                  {genderLabel}
                </li>
              ) : null}
              {languages.length > 0 ? (
                <li className="flex items-start gap-1.5">
                  <Languages className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  <span>{languages.join(", ")}</span>
                </li>
              ) : null}
            </ul>
          </div>
        </div>

        <div className="absolute top-0 right-0 flex flex-col items-end gap-2">
          {variant === "self" ? (
            <Link
              href="/profile/edit"
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

      {/* Metrics — no Top Rated */}
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
          <h2 className="text-sm font-extrabold">About Me</h2>
        </div>
        <ExpandableText text={about} />
      </section>

      {/* Skills */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-extrabold">Skills & Work Type</h2>
          {skills.length > 4 ? (
            <button
              type="button"
              onClick={() => setShowAllSkills((visible) => !visible)}
              aria-expanded={showAllSkills}
              className="text-xs font-bold text-primary"
            >
              {showAllSkills ? "Show Less" : "View All"}
            </button>
          ) : null}
        </div>
        {skills.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {shownSkills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center rounded-full border border-border/70 bg-card px-2.5 py-1 text-[11px] font-semibold"
              >
                {skill}
              </span>
            ))}
            {extraSkills > 0 ? (
              <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] font-bold text-primary">
                +{extraSkills} More
              </span>
            ) : null}
          </div>
        ) : (
          <p className="text-xs font-light text-muted-foreground">
            No skills listed yet.
          </p>
        )}
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2.5">
            <Briefcase className="size-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-[10px] font-light text-muted-foreground">
                Experience
              </p>
              <p className="truncate text-xs font-bold">{experience}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2.5">
            <GraduationCap className="size-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-[10px] font-light text-muted-foreground">
                Work Type
              </p>
              <p className="truncate text-xs font-bold">{workTypeLabel}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Work photos */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-extrabold">
            {variant === "self" ? "Work Photos" : "Profile Photos"}
          </h2>
          {workPhotos.length > 0 ? (
            <Link
              href={variant === "self" ? "/profile/photos" : "#photos"}
              className="text-xs font-bold text-primary"
            >
              View All
            </Link>
          ) : null}
        </div>
        {workPhotos.length > 0 ? (
          <div id="photos" className="flex gap-2 overflow-x-auto pb-1">
            {workPhotos.slice(0, 5).map((src, i) => {
              const isLast = i === 4 && workPhotos.length > 5;
              const inner = (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt=""
                    className="size-full object-cover"
                  />
                  {isLast ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-primary/70 text-sm font-extrabold text-white">
                      +{workPhotos.length - 4}
                    </div>
                  ) : null}
                </>
              );
              return variant === "self" ? (
                <Link
                  key={`${src.slice(0, 32)}-${i}`}
                  href="/profile/photos"
                  className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-muted"
                >
                  {inner}
                </Link>
              ) : (
                <div
                  key={`${src.slice(0, 32)}-${i}`}
                  className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-muted"
                >
                  {inner}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs font-light text-muted-foreground">
            No work photos yet.
          </p>
        )}
      </section>

      {/* Reliability — no verification block */}
      <section className="rounded-2xl border border-border/70 bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-extrabold">
              {variant === "self" ? "My Reliability Score" : "Reliability Score"}
            </h2>
            <Info className="size-3.5 text-muted-foreground" />
          </div>
          <span className="text-[11px] font-bold text-primary">How it works?</span>
        </div>
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
      </section>

      {/* Footer stats */}
      <section className="grid grid-cols-2 gap-2">
        <FooterStat
          icon={<Calendar className="size-4 text-primary" />}
          label="Member Since"
          value={memberSince}
        />
        {variant === "self" ? (
          <FooterStat
            icon={<Wallet className="size-4 text-primary" />}
            label="Total Earnings"
            value={formatPay(stats.totalEarnings)}
          />
        ) : (
          <Link href={reviewsHref} className="block">
            <FooterStat
              icon={<Star className="size-4 text-primary" />}
              label="Avg Rating"
              value={
                stats.avgRating != null ? stats.avgRating.toFixed(1) : "—"
              }
            />
          </Link>
        )}
        {variant === "self" ? (
          <Link href={reviewsHref} className="block">
            <FooterStat
              icon={<Star className="size-4 text-primary" />}
              label="Avg Rating"
              value={
                stats.avgRating != null ? stats.avgRating.toFixed(1) : "—"
              }
            />
          </Link>
        ) : (
          <FooterStat
            icon={<Briefcase className="size-4 text-primary" />}
            label="Gigs Completed"
            value={String(stats.jobsCompleted)}
          />
        )}
        <FooterStat
          icon={<Briefcase className="size-4 text-primary" />}
          label="Gigs in Progress"
          value={String(stats.jobsInProgress)}
        />
      </section>

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
