"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MapPin, Package } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { JobCard } from "@/components/job-card";
import { JobListingFilters } from "@/components/job-listing-filters";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoading } from "@/components/page-loading";
import { SectionHeader } from "@/components/layout/section-header";
import { LocationSelector } from "@/components/location-selector";
import { Badge } from "@/components/ui/badge";
import { jobCategoryIcons } from "@/features/jobs/components/job-category-icon";
import { useSessionProfile } from "@/hooks/use-session-profile";
import { useRouter } from "@/hooks/use-app-router";
import {
  countActiveJobFilters,
  filterJobs,
  parseJobListingFilters,
} from "@/lib/job-listing-filters";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES, greetingForNow, haversineKm } from "@/lib/utils";
import type { Job, JobCategory } from "@/types/database";

type NearbyJob = Job & {
  business_profiles: {
    business_name: string;
    verified: boolean;
  } | null;
  distanceKm: number;
};

export default function FreelancerHomePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <FreelancerHomeContent />
    </Suspense>
  );
}

function FreelancerHomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const category = searchParams.get("category") ?? "all";
  const filters = useMemo(
    () => parseJobListingFilters(searchParams),
    [searchParams],
  );
  const { user, profile, loading: sessionLoading } = useSessionProfile();
  const userId = user?.id;
  const profileLat = profile?.lat ?? null;
  const profileLng = profile?.lng ?? null;
  const profileRadius = profile?.search_radius_km ?? null;
  const profileArea = profile?.area ?? null;
  const profileCity = profile?.city ?? null;
  const [nearby, setNearby] = useState<NearbyJob[]>([]);
  const [hasUserLocation, setHasUserLocation] = useState(false);
  const [area, setArea] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [radius, setRadius] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const visibleJobs = useMemo(
    () => filterJobs(nearby, filters),
    [nearby, filters],
  );
  const activeFilterCount = countActiveJobFilters(filters);

  function categoryHref(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("category");
    } else {
      params.set("category", value);
    }
    const query = params.toString();
    return query ? `/freelancer?${query}` : "/freelancer";
  }

  useEffect(() => {
    if (sessionLoading) return;
    if (!userId) {
      router.replace("/login");
      return;
    }

    let cancelled = false;

    async function load() {
      const supabase = createClient();

      let query = supabase
        .from("jobs")
        .select("*, business_profiles(business_name, verified)")
        .eq("status", "live")
        .order("job_date", { ascending: true });

      if (category !== "all") {
        query = query.eq("category", category as JobCategory);
      }

      const [{ data: jobs }, { data: availableRows }] = await Promise.all([
        query,
        supabase.rpc("available_job_ids"),
      ]);
      const availableJobIds = new Set(
        ((availableRows ?? []) as { job_id: string }[]).map((row) => row.job_id),
      );

      const located = profileLat !== null && profileLng !== null;

      const nextNearby = located
        ? ((jobs ?? []) as (Job & {
            business_profiles: {
              business_name: string;
              verified: boolean;
            } | null;
          })[])
            .filter((job) => availableJobIds.has(job.id))
            .map((job) => ({
              ...job,
              distanceKm: haversineKm(profileLat, profileLng, job.lat, job.lng),
            }))
            .filter(
              (job) =>
                profileRadius == null || job.distanceKm <= profileRadius,
            )
            .sort((a, b) => a.distanceKm - b.distanceKm)
        : [];

      if (cancelled) return;
      setLat(profileLat);
      setLng(profileLng);
      setRadius(profileRadius);
      setArea(profileArea);
      setCity(profileCity);
      setHasUserLocation(located);
      setNearby(nextNearby);
      setLoading(false);
      setHasLoaded(true);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [
    sessionLoading,
    userId,
    profileLat,
    profileLng,
    profileRadius,
    profileArea,
    profileCity,
    category,
    router,
  ]);

  // Only blank the first paint — keep previous list while category refetches.
  if (sessionLoading || (!hasLoaded && loading)) {
    return <PageLoading />;
  }

  return (
    <div className="space-y-4 px-4 pb-4 pt-1">
      <PageHeader
        title={
          <>
            {greetingForNow()},{" "}
            <span className="font-semibold">
              {(profile?.full_name || "there").split(" ")[0]}
            </span>{" "}
            <span aria-hidden>👋</span>
          </>
        }
        description="Find gigs near you and earn on your terms."
        action={
          <JobListingFilters filters={filters} searchParams={searchParams} />
        }
      />

      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-0.5">
        {CATEGORIES.map((cat) => {
          const active = category === cat.value;
          const Icon =
            cat.value === "all"
              ? Package
              : (jobCategoryIcons[cat.value as JobCategory] ?? Package);
          return (
            <Badge
              key={cat.value}
              variant={active ? "default" : "outline"}
              size="sm"
              className="shrink-0"
              asChild
            >
              <Link href={categoryHref(cat.value)}>
                <Icon data-icon="inline-start" />
                {cat.label}
              </Link>
            </Badge>
          );
        })}
      </div>

      <SectionHeader
        title={
          activeFilterCount > 0
            ? `${visibleJobs.length} matching ${
                visibleJobs.length === 1 ? "gig" : "gigs"
              }`
            : "Gigs Near You"
        }
        action={
          <LocationSelector
            area={area}
            city={city}
            lat={lat}
            lng={lng}
            searchRadiusKm={radius}
            compact
          />
        }
      />

      <div className="space-y-3">
        {visibleJobs.length === 0 ? (
          <EmptyState
            className="rounded-2xl"
            icon={<MapPin aria-hidden="true" className="size-5" />}
            title={
              activeFilterCount > 0 && nearby.length > 0
                ? "No Gigs Match"
                : hasUserLocation
                  ? "No Gigs Nearby Yet"
                  : "Set Your Location"
            }
            description={
              activeFilterCount > 0 && nearby.length > 0
                ? "Try widening your pay or date range, or clearing a filter."
                : hasUserLocation
                ? "Tap your location to move the pin or widen your radius."
                : "Add your location to see gigs within your preferred radius."
            }
          />
        ) : (
          visibleJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              businessName={job.business_profiles?.business_name}
              verified={job.business_profiles?.verified}
              distanceKm={job.distanceKm}
              href={`/freelancer/jobs/${job.id}`}
            />
          ))
        )}
      </div>
    </div>
  );
}
