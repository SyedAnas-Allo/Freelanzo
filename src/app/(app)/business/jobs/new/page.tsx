"use client";

import { useEffect, useState } from "react";
import { PageLoading } from "@/components/page-loading";
import { useSessionProfile } from "@/hooks/use-session-profile";
import { useRouter } from "@/hooks/use-app-router";
import {
  postJobSetupHref,
  profileNeedsPostJobSetup,
} from "@/lib/profile-eligibility";
import { PostJobForm } from "./_components/post-job-form";

const POST_JOB_PATH = "/business/jobs/new";

export default function PostJobPage() {
  const router = useRouter();
  const { business, profile, loading, reload } = useSessionProfile();
  const [checkingPhone, setCheckingPhone] = useState(true);

  useEffect(() => {
    if (loading) return;

    let cancelled = false;
    void (async () => {
      let nextBusiness = business;
      let nextProfile = profile;

      if (!nextBusiness) {
        // Stale session after setup used to redirect → setup → returnTo → here forever.
        const next = await reload();
        if (cancelled) return;
        nextBusiness = next.business;
        nextProfile = next.profile;
        if (!nextBusiness) {
          router.replace(
            `/business/setup?returnTo=${encodeURIComponent(POST_JOB_PATH)}`,
          );
          return;
        }
      }

      if (cancelled) return;

      if (!nextProfile || profileNeedsPostJobSetup(nextProfile)) {
        router.replace(postJobSetupHref(POST_JOB_PATH));
        return;
      }

      setCheckingPhone(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [business, profile, loading, reload, router]);

  if (loading || !business || checkingPhone) {
    return <PageLoading />;
  }

  return <PostJobForm />;
}
