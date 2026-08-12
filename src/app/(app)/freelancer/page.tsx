"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Briefcase, MapPin, Zap } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { ExploreCategories } from "@/components/explore-categories";
import { JobCard } from "@/components/job-card";
import { PageLoading } from "@/components/page-loading";
import { SectionHeader } from "@/components/layout/section-header";
import { LocationSelector } from "@/components/location-selector";
import { QuickActionCard } from "@/components/shared/quick-action-card";
import { useSessionProfile } from "@/hooks/use-session-profile";
import { useRouter } from "@/hooks/use-app-router";
import { createClient } from "@/lib/supabase/client";
import { haversineKm } from "@/lib/utils";
import type { Job, JobCategory } from "@/types/database";

type NearbyJob = Job & {
  business_profiles: {
    business_name: string;
    verified: boolean;
  } | null;
  distanceKm: number;
};

type HomeFilter = "nearby" | "new" | "skilled";

const NEW_GIG_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function parseFilter(value: string | null): HomeFilter {
  if (value === "new" || value === "skilled" || value === "nearby") return value;
  return "nearby";
}

function filterHref(filter: HomeFilter, category: string) {
  const params = new URLSearchParams();
  if (category !== "all") params.set("category", category);
  if (filter !== "nearby") params.set("filter", filter);
  const qs = params.toString();
  return qs ? `/freelancer?${qs}` : "/freelancer";
}

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
  const filterParam = searchParams.get("filter");
  const filter = parseFilter(filterParam);
  const { user, profile, loading: sessionLoading } = useSessionProfile();
  const userId = user?.id;
  const profileLat = profile?.lat ?? null;
  const profileLng = profile?.lng ?? null;
  const profileRadius = profile?.search_radius_km ?? 10;
  const profileArea = profile?.area ?? null;
  const profileCity = profile?.city ?? null;
  const [nearby, setNearby] = useState<NearbyJob[]>([]);
  const [hasUserLocation, setHasUserLocation] = useState(false);
  const [area, setArea] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [radius, setRadius] = useState(10);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

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
            .filter((job) => job.distanceKm <= profileRadius)
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

  const visibleJobs = useMemo(() => {
    const now = Date.now();
    if (filter === "skilled") {
      return nearby.filter((job) => job.skilled);
    }
    if (filter === "new") {
      return [...nearby]
        .filter((job) => {
          const created = new Date(job.created_at).getTime();
          return !Number.isNaN(created) && now - created <= NEW_GIG_WINDOW_MS;
        })
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
    }
    return nearby;
  }, [nearby, filter]);

  const sectionTitle =
    filter === "new"
      ? "New Gigs"
      : filter === "skilled"
        ? "Skilled Gigs"
        : "Gigs Near You";

  // Only blank the first paint — keep previous list while category refetches.
  if (sessionLoading || (!hasLoaded && loading)) {
    return <PageLoading />;
  }

  return (
    <div className="space-y-4 px-4 pb-4 pt-2">
      <LocationSelector
        area={area}
        city={city}
        lat={lat}
        lng={lng}
        searchRadiusKm={radius}
        variant="bar"
      />

      <ExploreCategories activeCategory={category} />

      <div className="flex gap-2 overflow-x-auto hide-scrollbar">
        <QuickActionCard
          href={filterHref("new", category)}
          title="New Gigs"
          subtitle="Recently posted"
          tone="amber"
          icon={<Zap aria-hidden className="fill-amber-400" />}
        />
        <QuickActionCard
          href={filterHref("skilled", category)}
          title="Skilled Gigs"
          subtitle="Top skilled jobs"
          tone="sky"
          icon={<Briefcase aria-hidden />}
        />
        <QuickActionCard
          href={filterHref("nearby", category)}
          title="Nearby Gigs"
          subtitle="Near you"
          tone="emerald"
          icon={<MapPin aria-hidden className="text-sky-500" />}
        />
      </div>

      <SectionHeader
        title={sectionTitle}
        action={{ label: "See all", href: filterHref("nearby", "all") }}
      />

      <div className="space-y-3">
        {visibleJobs.length === 0 ? (
          <EmptyState
            className="rounded-2xl"
            icon={<MapPin aria-hidden="true" className="size-5" />}
            title={
              !hasUserLocation
                ? "Set Your Location"
                : filter === "skilled"
                  ? "No Skilled Gigs Nearby"
                  : filter === "new"
                    ? "No New Gigs Nearby"
                    : "No Gigs Nearby Yet"
            }
            description={
              !hasUserLocation
                ? "Add your location to see gigs within your preferred radius."
                : filter === "skilled"
                  ? "Try Nearby Gigs or widen your search radius."
                  : filter === "new"
                    ? "Check back soon — or browse all nearby gigs."
                    : "Tap Change to move the pin or widen your radius."
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
