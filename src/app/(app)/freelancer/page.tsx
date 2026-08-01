import Link from "next/link";
import { MapPin, Package } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { JobCard } from "@/components/job-card";
import { PageHeader } from "@/components/layout/page-header";
import { SectionHeader } from "@/components/layout/section-header";
import { LocationSelector } from "@/components/location-selector";
import { Badge } from "@/components/ui/badge";
import { jobCategoryIcons } from "@/features/jobs/components/job-category-icon";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, greetingForNow, haversineKm } from "@/lib/utils";
import type { Job, JobCategory } from "@/types/database";

export default async function FreelancerHomePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category = "all" } = await searchParams;
  const { profile } = await getSessionProfile();
  const supabase = await createClient();

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

  const lat = profile?.lat ?? null;
  const lng = profile?.lng ?? null;
  const radius = profile?.search_radius_km ?? 10;
  const area = profile?.area ?? null;
  const city = profile?.city ?? null;
  const hasUserLocation = lat !== null && lng !== null;

  const nearby = hasUserLocation
    ? ((jobs ?? []) as (Job & {
        business_profiles: {
          business_name: string;
          verified: boolean;
        } | null;
      })[])
        .filter((job) => availableJobIds.has(job.id))
        .map((job) => ({
          ...job,
          distanceKm: haversineKm(lat, lng, job.lat, job.lng),
        }))
        .filter((job) => job.distanceKm <= radius)
        .sort((a, b) => a.distanceKm - b.distanceKm)
    : [];

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
              <Link href={`/freelancer?category=${cat.value}`}>
                <Icon data-icon="inline-start" />
                {cat.label}
              </Link>
            </Badge>
          );
        })}
      </div>

      <SectionHeader
        title="Gigs Near You"
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
        {nearby.length === 0 ? (
          <EmptyState
            className="rounded-2xl"
            icon={<MapPin aria-hidden="true" className="size-5" />}
            title={hasUserLocation ? "No Gigs Nearby Yet" : "Set Your Location"}
            description={
              hasUserLocation
                ? "Tap your location to move the pin or widen your radius."
                : "Add your location to see gigs within your preferred radius."
            }
          />
        ) : (
          nearby.map((job) => (
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
