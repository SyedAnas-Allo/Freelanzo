"use client";

import { useEffect } from "react";
import { PageLoading } from "@/components/page-loading";
import { useSessionProfile } from "@/hooks/use-session-profile";
import { useRouter } from "@/hooks/use-app-router";
import { PostJobForm } from "./_components/post-job-form";

export default function PostJobPage() {
  const router = useRouter();
  const { business, loading, reload } = useSessionProfile();

  useEffect(() => {
    if (loading) return;
    if (business) return;

    let cancelled = false;
    void (async () => {
      // Stale session after setup used to redirect → setup → returnTo → here forever.
      const next = await reload();
      if (cancelled) return;
      if (!next.business) {
        router.replace(
          `/business/setup?returnTo=${encodeURIComponent("/business/jobs/new")}`,
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [business, loading, reload, router]);

  if (loading || !business) {
    return <PageLoading />;
  }

  return <PostJobForm />;
}
