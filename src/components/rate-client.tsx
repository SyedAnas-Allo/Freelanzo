"use client";

import { useRouter } from "@/hooks/use-app-router";
import { useMemo, useState, useTransition } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { JobHeroCard } from "@/components/job-hero-card";
import { PageContent } from "@/components/layout/page-content";
import { PageBack } from "@/components/page-back";
import { ReportSheet } from "@/components/report-sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Surface } from "@/components/ui/surface";
import { Textarea } from "@/components/ui/textarea";
import {
  BUSINESS_RATES_FREELANCER,
  FREELANCER_RATES_BUSINESS,
  averageDimensions,
} from "@/lib/ratings";
import type { ReportDirection } from "@/lib/reports";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Job } from "@/types/database";

function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => {
        const n = i + 1;
        return (
          <button
            key={n}
            type="button"
            aria-label={`${n} stars`}
            onClick={() => onChange(n)}
            className="p-0.5"
          >
            <Star
              className={cn(
                "size-7",
                n <= value
                  ? "fill-amber-400 text-amber-400"
                  : "fill-muted text-muted",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

export function RateClient({
  job,
  applicationId,
  mode,
  alreadyRated,
  counterpartName,
  reportedUserId,
}: {
  job: Job;
  applicationId: string;
  mode: "business" | "freelancer";
  alreadyRated: boolean;
  counterpartName: string;
  reportedUserId: string;
}) {
  const router = useRouter();
  const backHref =
    mode === "business"
      ? `/business/jobs/${job.id}/payment`
      : `/freelancer/jobs/${job.id}/payment`;
  const dims =
    mode === "business" ? BUSINESS_RATES_FREELANCER : FREELANCER_RATES_BUSINESS;
  const direction: ReportDirection =
    mode === "business"
      ? "business_to_freelancer"
      : "freelancer_to_business";
  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(dims.map((d) => [d.key, 0])),
  );
  const [overall, setOverall] = useState(0);
  const [comment, setComment] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const computed = useMemo(() => {
    const avg = averageDimensions(scores);
    return overall || Math.round(avg * 10) / 10;
  }, [scores, overall]);

  function submit() {
    const finalOverall = overall || computed;
    if (!finalOverall || finalOverall < 1) {
      toast.error("Please rate at least overall stars");
      return;
    }
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc("submit_rating", {
        p_application_id: applicationId,
        p_overall: finalOverall,
        p_dimensions: scores,
        p_comment: comment || null,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Rating submitted");
      router.push(mode === "business" ? "/reviews" : "/reviews");
      router.refresh();
    });
  }

  const reportLink = (
    <button
      type="button"
      className="text-xs font-semibold text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
      onClick={() => setReportOpen(true)}
    >
      Report a problem with {counterpartName}
    </button>
  );

  const reportSheet = (
    <ReportSheet
      open={reportOpen}
      onOpenChange={setReportOpen}
      direction={direction}
      reportedUserId={reportedUserId}
      reportedName={counterpartName}
      jobId={job.id}
      applicationId={applicationId}
    />
  );

  if (alreadyRated) {
    return (
      <PageContent>
        <PageBack href={backHref} />
        <JobHeroCard job={job} />
        <Surface className="text-center">
          <p className="text-sm font-bold">You already rated {counterpartName}</p>
          <p className="mt-1 text-xs font-light text-muted-foreground">
            Ratings stay hidden until both sides submit or 48 hours pass.
          </p>
          <Button className="mt-4 w-full" onClick={() => router.push("/reviews")}>
            View Reviews
          </Button>
          <div className="mt-4">{reportLink}</div>
        </Surface>
        {reportSheet}
      </PageContent>
    );
  }

  return (
    <PageContent>
      <PageBack href={backHref} />
      <JobHeroCard job={job} />

      <Surface>
        <h2 className="text-sm font-extrabold">Rate {counterpartName}</h2>
        <p className="mt-1 text-xs font-light text-muted-foreground">
          Ratings stay hidden until both submit or the rating period expires.
        </p>

        <div className="mt-4 space-y-1">
          <Label>Overall</Label>
          <StarPicker
            value={overall || Math.round(computed)}
            onChange={setOverall}
          />
        </div>

        <div className="mt-4 space-y-3">
          {dims.map((d) => (
            <div key={d.key}>
              <Label className="text-xs">{d.label}</Label>
              <StarPicker
                value={scores[d.key] ?? 0}
                onChange={(n) => setScores((s) => ({ ...s, [d.key]: n }))}
              />
            </div>
          ))}
        </div>

        <Textarea
          className="mt-4"
          placeholder="Optional comment…"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </Surface>

      <Button className="w-full" disabled={pending} onClick={submit}>
        {pending ? "Submitting…" : "Submit Rating"}
      </Button>

      <div className="flex justify-center pt-1">{reportLink}</div>
      {reportSheet}
    </PageContent>
  );
}
