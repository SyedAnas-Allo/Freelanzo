"use client";

import { useEffect } from "react";
import { PageLoading } from "@/components/page-loading";
import { useSessionProfile } from "@/hooks/use-session-profile";
import { useRouter } from "@/hooks/use-app-router";
import { PostJobForm } from "./_components/post-job-form";

export default function PostJobPage() {
  const router = useRouter();
  const { business, loading } = useSessionProfile();

  useEffect(() => {
    if (loading) return;
    if (!business) {
      router.replace(
        `/business/setup?returnTo=${encodeURIComponent("/business/jobs/new")}`,
      );
    }
  }, [business, loading, router]);

  if (loading || !business) {
    return <PageLoading />;
  }

  return <PostJobForm />;
}
