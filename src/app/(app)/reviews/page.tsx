import Link from "next/link";
import { Star } from "lucide-react";
import { PageBack } from "@/components/page-back";
import { ReviewListItem, StarRow } from "@/components/review-list-item";
import { Badge } from "@/components/ui/badge";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Rating } from "@/types/database";

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab = "received" } = await searchParams;
  const { user } = await getSessionProfile();
  if (!user) return null;
  const supabase = await createClient();

  const { data: received } = await supabase
    .from("ratings")
    .select("*")
    .eq("to_user_id", user.id)
    .order("created_at", { ascending: false });

  const { data: given } = await supabase
    .from("ratings")
    .select("*")
    .eq("from_user_id", user.id)
    .order("created_at", { ascending: false });

  const receivedList = (received ?? []) as Rating[];
  const givenList = (given ?? []) as Rating[];
  const list = tab === "given" ? givenList : receivedList;

  const avg =
    receivedList.length > 0
      ? receivedList.reduce((s, r) => s + Number(r.overall), 0) /
        receivedList.length
      : 0;

  const buckets = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: receivedList.filter(
      (r) => Math.round(Number(r.overall)) === stars,
    ).length,
  }));
  const maxBucket = Math.max(1, ...buckets.map((b) => b.count));

  const counterpartIds = [
    ...new Set(
      list.map((r) => (tab === "given" ? r.to_user_id : r.from_user_id)),
    ),
  ];
  const { data: profiles } = counterpartIds.length
    ? await supabase.from("profiles").select("*").in("id", counterpartIds)
    : { data: [] };
  const profileMap = new Map(
    ((profiles ?? []) as Profile[]).map((p) => [p.id, p]),
  );

  return (
    <div className="px-4 py-4 pb-8">
      <PageBack href="/profile" />
      <div className="mt-1 flex items-start justify-between gap-3">
        <h1 className="text-xl font-extrabold tracking-tight">
          Ratings & Reviews
        </h1>
        <Link
          href={`/reviews/${user.id}`}
          className="shrink-0 rounded-full border border-border/70 bg-card px-3 py-1.5 text-[11px] font-bold text-primary shadow-sm"
        >
          Public view
        </Link>
      </div>

      <div className="mt-4 flex gap-4 border-b border-border/60">
        {[
          ["received", `Received (${receivedList.length})`],
          ["given", `Given (${givenList.length})`],
        ].map(([key, label]) => (
          <Link
            key={key}
            href={`/reviews?tab=${key}`}
            className={
              tab === key
                ? "border-b-2 border-primary pb-2 text-sm font-bold text-primary"
                : "pb-2 text-sm font-medium text-muted-foreground"
            }
          >
            {label}
          </Link>
        ))}
      </div>

      {tab === "received" ? (
        <div className="mt-4 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground">
            Overall Rating
          </p>
          <div className="mt-2 flex items-end gap-2">
            <p className="text-4xl font-extrabold">
              {avg ? avg.toFixed(1) : "—"}
            </p>
            <Star className="mb-1.5 size-5 fill-amber-400 text-amber-400" />
            {avg >= 4.5 ? (
              <Badge variant="success" size="sm" className="mb-1.5">
                Excellent
              </Badge>
            ) : null}
          </div>
          {avg > 0 ? <StarRow value={avg} size="md" className="mt-2" /> : null}
          <div className="mt-3 space-y-1.5">
            {buckets.map((b) => (
              <div key={b.stars} className="flex items-center gap-2 text-xs">
                <span className="w-3 font-semibold">{b.stars}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(b.count / maxBucket) * 100}%` }}
                  />
                </div>
                <span className="w-4 text-muted-foreground">{b.count}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-2">
        {list.length === 0 ? (
          <p className="py-10 text-center text-sm font-light text-muted-foreground">
            No reviews yet.
          </p>
        ) : (
          list.map((r) => {
            const p = profileMap.get(
              tab === "given" ? r.to_user_id : r.from_user_id,
            );
            return (
              <ReviewListItem
                key={r.id}
                name={p?.full_name || "User"}
                photoUrl={p?.photo_url}
                role={p?.work_type || undefined}
                rating={Number(r.overall)}
                date={new Date(r.created_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                })}
                comment={r.comment}
                verified
              />
            );
          })
        )}
      </div>
    </div>
  );
}
