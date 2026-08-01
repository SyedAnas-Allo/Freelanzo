import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Briefcase } from "lucide-react";
import { BusinessProfileView } from "@/components/business-profile-view";
import { PageBack } from "@/components/page-back";
import { ReportMenuButton } from "@/components/report-menu-button";
import { ReviewListItem } from "@/components/review-list-item";
import { SettingsGroup, SettingsRow } from "@/components/settings-row";
import { getSessionProfile } from "@/lib/auth";
import { loadBusinessStats } from "@/lib/load-business-stats";
import { createClient } from "@/lib/supabase/server";
import type { BusinessProfile, Profile, Rating } from "@/types/database";

export default async function BusinessPublicProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; job?: string }>;
}) {
  const { id } = await params;
  const { from, job: jobId } = await searchParams;
  const { user } = await getSessionProfile();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: business } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!business) notFound();

  const biz = business as BusinessProfile;
  const stats = await loadBusinessStats(supabase, biz.id, biz.owner_id);

  const { data: owner } = await supabase
    .from("profiles")
    .select("area, city")
    .eq("id", biz.owner_id)
    .maybeSingle();
  const ownerProfile = owner as Pick<Profile, "area" | "city"> | null;
  const location =
    [ownerProfile?.area, ownerProfile?.city].filter(Boolean).join(", ") ||
    biz.address;

  const { data: ratings } = await supabase
    .from("ratings")
    .select("*")
    .eq("to_user_id", biz.owner_id)
    .order("created_at", { ascending: false })
    .limit(5);
  const recentRatings = (ratings ?? []) as Rating[];
  const reviewerIds = [...new Set(recentRatings.map((r) => r.from_user_id))];
  const { data: reviewers } = reviewerIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, photo_url")
        .in("id", reviewerIds)
    : { data: [] };
  const reviewerMap = new Map(
    ((reviewers ?? []) as Pick<Profile, "id" | "full_name" | "photo_url">[]).map(
      (p) => [p.id, p],
    ),
  );

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
                  <h2 className="text-sm font-extrabold">
                    Recent Reviews
                  </h2>
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
