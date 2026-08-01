"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useRouter } from "@/hooks/use-app-router";
import { Briefcase } from "lucide-react";
import { BusinessProfileView } from "@/components/business-profile-view";
import { PageBack } from "@/components/page-back";
import { PageLoading } from "@/components/page-loading";
import { ReportMenuButton } from "@/components/report-menu-button";
import { ReviewListItem } from "@/components/review-list-item";
import { SettingsGroup, SettingsRow } from "@/components/settings-row";
import { loadBusinessStats } from "@/lib/load-business-stats";
import {
  type BusinessProfileStats,
} from "@/lib/profile-stats";
import { createClient } from "@/lib/supabase/client";
import type { BusinessProfile, Profile, Rating } from "@/types/database";

const EMPTY_STATS: BusinessProfileStats = {
  jobsPosted: 0,
  jobsCompleted: 0,
  jobsCancelled: 0,
  freelancersHired: 0,
  paymentRate: 100,
  cancelRate: 0,
  reliability: 80,
  avgRating: null,
  reviewCount: 0,
  activeGigs: 0,
  categories: [],
};

export default function BusinessPublicProfilePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <BusinessPublicProfileInner />
    </Suspense>
  );
}

function BusinessPublicProfileInner() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params.id;
  const from = searchParams.get("from");
  const jobId = searchParams.get("job");

  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [biz, setBiz] = useState<BusinessProfile | null>(null);
  const [location, setLocation] = useState("");
  const [stats, setStats] = useState<BusinessProfileStats>(EMPTY_STATS);
  const [recentRatings, setRecentRatings] = useState<Rating[]>([]);
  const [reviewerMap, setReviewerMap] = useState<
    Map<string, Pick<Profile, "id" | "full_name" | "photo_url">>
  >(() => new Map());

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: business } = await supabase
        .from("business_profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!business) {
        setMissing(true);
        setLoading(false);
        return;
      }

      const nextBiz = business as BusinessProfile;
      setBiz(nextBiz);

      const nextStats = await loadBusinessStats(
        supabase,
        nextBiz.id,
        nextBiz.owner_id,
      );
      setStats(nextStats);

      const { data: owner } = await supabase
        .from("profiles")
        .select("area, city")
        .eq("id", nextBiz.owner_id)
        .maybeSingle();
      const ownerProfile = owner as Pick<Profile, "area" | "city"> | null;
      setLocation(
        [ownerProfile?.area, ownerProfile?.city].filter(Boolean).join(", ") ||
          nextBiz.address ||
          "",
      );

      const { data: ratings } = await supabase
        .from("ratings")
        .select("*")
        .eq("to_user_id", nextBiz.owner_id)
        .order("created_at", { ascending: false })
        .limit(5);
      const recent = (ratings ?? []) as Rating[];
      setRecentRatings(recent);

      const reviewerIds = [...new Set(recent.map((r) => r.from_user_id))];
      const { data: reviewers } = reviewerIds.length
        ? await supabase
            .from("profiles")
            .select("id, full_name, photo_url")
            .in("id", reviewerIds)
        : { data: [] };
      setReviewerMap(
        new Map(
          (
            (reviewers ?? []) as Pick<
              Profile,
              "id" | "full_name" | "photo_url"
            >[]
          ).map((p) => [p.id, p]),
        ),
      );
      setLoading(false);
    }
    void load();
  }, [id, router]);

  if (loading) return <PageLoading />;

  if (missing || !biz) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="font-bold">Business not found</p>
        <Link href="/freelancer" className="mt-4 inline-block text-sm font-bold text-primary">
          Back
        </Link>
      </div>
    );
  }

  const backHref =
    from && from.startsWith("/") && !from.startsWith("//")
      ? from
      : jobId
        ? `/freelancer/jobs/${jobId}`
        : "/freelancer";

  return (
    <div className="space-y-4 px-4 py-4 pb-8">
      <div className="flex items-center justify-between gap-2">
        <PageBack href={backHref} />
        <ReportMenuButton
          direction="freelancer_to_business"
          reportedUserId={biz.owner_id}
          reportedName={biz.business_name}
          jobId={jobId ?? null}
          applicationId={null}
        />
      </div>

      <BusinessProfileView
        business={biz}
        location={location}
        stats={stats}
        variant="public"
        footer={
          <div className="space-y-3">
            {recentRatings.length > 0 ? (
              <section className="rounded-2xl border border-border/70 bg-card px-3">
                <div className="flex items-center justify-between border-b border-border/50 py-3">
                  <h2 className="text-sm font-extrabold">Recent Reviews</h2>
                  <Link
                    href={`/reviews/${biz.owner_id}?from=${encodeURIComponent(`/freelancer/businesses/${biz.id}`)}`}
                    className="text-xs font-bold text-primary"
                  >
                    View all
                  </Link>
                </div>
                {recentRatings.map((r) => {
                  const reviewer = reviewerMap.get(r.from_user_id);
                  return (
                    <ReviewListItem
                      key={r.id}
                      name={reviewer?.full_name || "Freelancer"}
                      photoUrl={reviewer?.photo_url}
                      role="Freelancer"
                      rating={Number(r.overall)}
                      date={new Date(r.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      comment={r.comment}
                    />
                  );
                })}
              </section>
            ) : null}

            <SettingsGroup>
              <SettingsRow
                href="/freelancer"
                icon={<Briefcase className="size-4" />}
                label="Browse Open Gigs"
                description="Find live gigs near you"
              />
            </SettingsGroup>
          </div>
        }
      />

      {from || jobId ? (
        <p className="text-center text-[11px] font-medium text-muted-foreground">
          <Link href={backHref} className="font-bold text-primary">
            Back to gig
          </Link>
        </p>
      ) : null}
    </div>
  );
}
