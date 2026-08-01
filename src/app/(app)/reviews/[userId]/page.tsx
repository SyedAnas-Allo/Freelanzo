import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Star } from "lucide-react";
import { PageBack } from "@/components/page-back";
import { ReviewListItem, StarRow } from "@/components/review-list-item";
import { Badge } from "@/components/ui/badge";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { BusinessProfile, Profile, Rating } from "@/types/database";

function safeFrom(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export default async function PublicReviewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { userId } = await params;
  const { from } = await searchParams;
  const { user, profile: me } = await getSessionProfile();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: subject } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (!subject) notFound();

  const subjectProfile = subject as Profile;
  const isSelf = user.id === userId;

  const { data: business } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("owner_id", userId)
    .maybeSingle();
  const biz = business as BusinessProfile | null;

  const subjectName =
    biz?.business_name || subjectProfile.full_name || "User";
  const subjectRole = biz ? "Business" : "Freelancer";

  const { data: received } = await supabase
    .from("ratings")
    .select("*")
    .eq("to_user_id", userId)
    .order("created_at", { ascending: false });
  const list = (received ?? []) as Rating[];

  const avg =
    list.length > 0
      ? list.reduce((s, r) => s + Number(r.overall), 0) / list.length
      : 0;

  const buckets = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: list.filter((r) => Math.round(Number(r.overall)) === stars).length,
  }));
  const maxBucket = Math.max(1, ...buckets.map((b) => b.count));

  const reviewerIds = [...new Set(list.map((r) => r.from_user_id))];
  const [{ data: profiles }, { data: reviewerBusinesses }] = await Promise.all([
    reviewerIds.length
      ? supabase.from("profiles").select("*").in("id", reviewerIds)
      : Promise.resolve({ data: [] }),
    reviewerIds.length
      ? supabase
          .from("business_profiles")
          .select("owner_id, business_name, logo_url, verified")
          .in("owner_id", reviewerIds)
      : Promise.resolve({ data: [] }),
  ]);

  const profileMap = new Map(
    ((profiles ?? []) as Profile[]).map((p) => [p.id, p]),
  );
  const bizMap = new Map(
    (
      (reviewerBusinesses ?? []) as Pick<
        BusinessProfile,
        "owner_id" | "business_name" | "logo_url" | "verified"
      >[]
    ).map((b) => [b.owner_id, b]),
  );

  const backHref =
    safeFrom(from) ??
    (isSelf
      ? "/profile"
      : biz
        ? `/freelancer/businesses/${biz.id}`
        : me?.active_mode === "business"
          ? `/business/freelancers/${userId}`
          : "/freelancer");

  return (
    <div className="space-y-4 px-4 py-4 pb-8">
      <PageBack href={backHref} />

      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Ratings & Reviews
          </p>
          <h1 className="mt-0.5 truncate text-xl font-extrabold tracking-tight">
            {subjectName}
          </h1>
          <p className="mt-0.5 text-xs font-medium text-muted-foreground">
            {subjectRole}
            {isSelf ? " · Your public reviews" : ""}
          </p>
        </div>
        {isSelf ? (
          <Link
            href="/reviews"
            className="shrink-0 rounded-full border border-border/70 bg-card px-3 py-1.5 text-[11px] font-bold text-primary shadow-sm"
          >
            My reviews
          </Link>
        ) : null}
      </header>

      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <p className="text-xs font-semibold text-muted-foreground">
          Overall Rating
        </p>
        <div className="mt-2 flex items-end gap-2">
          <p className="text-4xl font-extrabold">
            {list.length ? avg.toFixed(1) : "—"}
          </p>
          <Star className="mb-1.5 size-5 fill-amber-400 text-amber-400" />
          {avg >= 4.5 && list.length > 0 ? (
            <Badge variant="success" size="sm" className="mb-1.5">
              Excellent
            </Badge>
          ) : null}
        </div>
        {list.length > 0 ? (
          <StarRow value={avg} size="md" className="mt-2" />
        ) : null}
        <p className="mt-1 text-[11px] font-medium text-muted-foreground">
          {list.length} review{list.length === 1 ? "" : "s"}
        </p>
        <div className="mt-3 space-y-1.5">
          {buckets.map((b) => (
            <div key={b.stars} className="flex items-center gap-2 text-xs">
              <span className="w-3 font-semibold">{b.stars}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{
                    width: list.length
                      ? `${(b.count / maxBucket) * 100}%`
                      : "0%",
                  }}
                />
              </div>
              <span className="w-4 text-muted-foreground">{b.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        {list.length === 0 ? (
          <p className="py-10 text-center text-sm font-light text-muted-foreground">
            No public reviews yet.
          </p>
        ) : (
          list.map((r) => {
            const reviewerBiz = bizMap.get(r.from_user_id);
            const reviewer = profileMap.get(r.from_user_id);
            const name =
              reviewerBiz?.business_name ||
              reviewer?.full_name ||
              "User";
            const role = reviewerBiz ? "Business" : "Freelancer";
            const photo =
              reviewerBiz?.logo_url || reviewer?.photo_url || null;
            return (
              <ReviewListItem
                key={r.id}
                name={name}
                photoUrl={photo}
                role={role}
                rating={Number(r.overall)}
                date={new Date(r.created_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
                comment={r.comment}
                verified={!!reviewerBiz?.verified}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
