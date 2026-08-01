import { notFound, redirect } from "next/navigation";
import { Briefcase } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageContent } from "@/components/layout/page-content";
import { PageHeader } from "@/components/layout/page-header";
import { JobExperienceListItem } from "@/features/jobs/components/job-experience-list-item";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Job, Profile } from "@/types/database";

export default async function ApplicantExperiencePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ job?: string }>;
}) {
  const { id } = await params;
  const { job: jobId } = await searchParams;
  const { business } = await getSessionProfile();
  if (!business) redirect("/business/setup");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("id", id)
    .maybeSingle();
  if (!profile) notFound();

  const p = profile as Pick<Profile, "id" | "full_name">;

  const { data: apps } = await supabase
    .from("applications")
    .select("id, status, created_at, jobs(*)")
    .eq("freelancer_id", id)
    .eq("status", "accepted")
    .order("created_at", { ascending: false })
    .limit(20);

  const rows = (apps ?? []).map((a) => ({
    id: a.id,
    job: a.jobs as unknown as Job | null,
  }));

  const backHref = `/business/freelancers/${id}${jobId ? `?job=${jobId}` : ""}`;

  return (
    <PageContent>
      <PageHeader
        backHref={backHref}
        title="Work History"
        description={`${p.full_name || "Freelancer"}’s Freelanzo gigs`}
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
