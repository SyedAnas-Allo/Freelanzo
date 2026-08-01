"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useRouter } from "@/hooks/use-app-router";
import { Briefcase } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageContent } from "@/components/layout/page-content";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoading } from "@/components/page-loading";
import { JobExperienceListItem } from "@/features/jobs/components/job-experience-list-item";
import { createClient } from "@/lib/supabase/client";
import type { Job, Profile } from "@/types/database";

type ExperienceRow = {
  id: string;
  job: Job | null;
};

export default function ApplicantExperiencePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ApplicantExperienceInner />
    </Suspense>
  );
}

function ApplicantExperienceInner() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params.id;
  const jobId = searchParams.get("job");

  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [name, setName] = useState("Freelancer");
  const [rows, setRows] = useState<ExperienceRow[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: business } = await supabase
        .from("business_profiles")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (!business) {
        router.push("/business/setup");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("id", id)
        .maybeSingle();
      if (!profile) {
        setMissing(true);
        setLoading(false);
        return;
      }

      const p = profile as Pick<Profile, "id" | "full_name">;
      setName(p.full_name || "Freelancer");

      const { data: apps } = await supabase
        .from("applications")
        .select("id, status, created_at, jobs(*)")
        .eq("freelancer_id", id)
        .eq("status", "accepted")
        .order("created_at", { ascending: false })
        .limit(20);

      setRows(
        (apps ?? []).map((a) => ({
          id: a.id,
          job: a.jobs as unknown as Job | null,
        })),
      );
      setLoading(false);
    }
    void load();
  }, [id, router]);

  if (loading) return <PageLoading />;

  if (missing) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="font-bold">Freelancer not found</p>
        <Link href="/business" className="mt-4 inline-block text-sm font-bold text-primary">
          Back
        </Link>
      </div>
    );
  }

  const backHref = `/business/freelancers/${id}${jobId ? `?job=${jobId}` : ""}`;

  return (
    <PageContent>
      <PageHeader
        backHref={backHref}
        title="Work History"
        description={`${name}’s Freelanzo gigs`}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<Briefcase aria-hidden="true" className="size-5" />}
          title="No Gigs on Record Yet"
        />
      ) : (
        <div className="space-y-2">
          {rows.map(({ id: appId, job }) => {
            if (!job) return null;
            return (
              <JobExperienceListItem
                key={appId}
                job={job}
                statusLabel="Selected"
              />
            );
          })}
        </div>
      )}
    </PageContent>
  );
}
