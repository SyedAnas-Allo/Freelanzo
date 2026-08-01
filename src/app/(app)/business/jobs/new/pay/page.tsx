"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Banknote, Check, Shield } from "lucide-react";
import { toast } from "sonner";
import { InfoCallout } from "@/components/info-callout";
import { PageContent } from "@/components/layout/page-content";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { createClient } from "@/lib/supabase/client";
import { formatPay } from "@/lib/utils";
import type { JobGenderPreference } from "@/types/database";

type Draft = {
  business_id: string;
  title: string;
  category: string;
  headcount: number;
  pay_per_freelancer: number;
  job_date: string;
  work_dates: string[];
  start_time: string;
  end_time: string;
  area: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  description: string;
  skilled: boolean;
  gender_preference: JobGenderPreference;
  instructions: string | null;
  dress_code: string | null;
  food_allowance_inr: number;
  travel_allowance_inr: number;
  fee: number;
  freeRemaining: number;
  listFee: number;
};

export default function PostJobPayPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("freelanzo_job_draft");
    if (!raw) {
      router.replace("/business/jobs/new");
      return;
    }
    try {
      // Hydrate client-only session storage after the route mounts.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft(JSON.parse(raw) as Draft);
    } catch {
      router.replace("/business/jobs/new");
    }
  }, [router]);

  async function payAndPublish() {
    if (!draft) return;
    setPaying(true);

    // Brief pause so the publish button shows processing state
    await new Promise((r) => setTimeout(r, 400));

    const supabase = createClient();
    const { data: job, error } = await supabase
      .from("jobs")
      .insert({
        business_id: draft.business_id,
        title: draft.title,
        category: draft.category as never,
        headcount: draft.headcount,
        pay_per_freelancer: draft.pay_per_freelancer,
        job_date: draft.job_date,
        work_dates: draft.work_dates?.length
          ? draft.work_dates
          : [draft.job_date],
        start_time: draft.start_time,
        end_time: draft.end_time,
        area: draft.area,
        address: draft.address,
        city: draft.city,
        lat: draft.lat,
        lng: draft.lng,
        description: draft.description,
        skilled: draft.skilled,
        gender_preference: draft.gender_preference ?? "any",
        instructions: draft.instructions,
        dress_code: draft.dress_code,
        food_allowance_inr: draft.food_allowance_inr ?? 0,
        travel_allowance_inr: draft.travel_allowance_inr ?? 0,
        status: "live",
        safety_flags: { family_friendly: true, indoor: true },
      })
      .select("id")
      .single();

    setPaying(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    sessionStorage.removeItem("freelanzo_job_draft");
    toast.success(
      draft.fee === 0 ? "Gig posted — free credit used" : "Payment successful · Gig live",
    );
    router.push(`/business/jobs/${job.id}/posted`);
    router.refresh();
  }

  if (!draft) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <PageContent>
      <PageHeader
        backHref="/business/jobs/new"
        title="Posting Fee"
        description={
          <>
            Confirm payment to publish{" "}
            <span className="font-semibold">{draft.title}</span>.
          </>
        }
      />

      <Surface>
        <div className="flex items-center justify-between text-sm">
          <span className="font-light text-muted-foreground">Freelancers</span>
          <span className="font-bold">{draft.headcount}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="font-light text-muted-foreground">Rate</span>
          <span className="font-bold">₹50 × {draft.headcount}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="font-light text-muted-foreground">List fee</span>
          <span className="font-bold">{formatPay(draft.listFee)}</span>
        </div>
        {draft.freeRemaining > 0 ? (
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="font-light text-emerald-600">Free posts left</span>
            <span className="font-bold text-emerald-600">{draft.freeRemaining}</span>
          </div>
        ) : null}
        <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
          <span className="text-sm font-extrabold">Amount due</span>
          <span className="text-lg font-extrabold text-primary">
            {draft.fee === 0 ? "FREE" : formatPay(draft.fee)}
          </span>
        </div>
      </Surface>

      <InfoCallout
        title="Immediate payment required"
        variant="important"
        icon={<Banknote className="size-4" />}
      >
        <p>Pay every freelancer in full (Cash / UPI) as soon as the gig ends — no delays.</p>
        <p className="mt-1.5">
          Skipping or delaying payment can get your account suspended.
        </p>
      </InfoCallout>

      <InfoCallout title="Posting fee" icon={<Shield className="size-4" />}>
        <p>
          First two gigs are free. After that, the listing fee is charged when you
          publish. Fee is non-refundable once the gig is live.
        </p>
      </InfoCallout>

      <Button
        className="h-12 w-full rounded-xl"
        disabled={paying}
        onClick={payAndPublish}
      >
        {paying ? (
          "Processing…"
        ) : (
          <>
            <Check className="size-4" />
            {draft.fee === 0
              ? "Publish for Free"
              : `Pay ${formatPay(draft.fee)} & Publish`}
          </>
        )}
      </Button>

      <Button variant="outline" className="w-full rounded-xl" asChild>
        <Link href="/business/jobs/new">Back to edit</Link>
      </Button>
    </PageContent>
  );
}
