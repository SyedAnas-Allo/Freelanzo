"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/hooks/use-app-router";
import { PageContent } from "@/components/layout/page-content";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoading } from "@/components/page-loading";
import { FeedbackForm } from "@/components/feedback-form";
import { createClient } from "@/lib/supabase/client";
import type { AppFeedback } from "@/types/database";

export default function FeedbackPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [recent, setRecent] = useState<AppFeedback[]>([]);

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

      const { data } = await supabase
        .from("app_feedback")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(3);

      setRecent((data ?? []) as AppFeedback[]);
      setLoading(false);
    }
    void load();
  }, [router]);

  if (loading) return <PageLoading />;

  return (
    <PageContent className="pb-8">
      <PageHeader
        backHref="/profile"
        title="Send feedback"
        description="Rate Freelanzo and tell us how we can improve."
      />
      <FeedbackForm initialRecent={recent} />
    </PageContent>
  );
}
