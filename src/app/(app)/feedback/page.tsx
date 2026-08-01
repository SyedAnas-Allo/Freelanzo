import { PageContent } from "@/components/layout/page-content";
import { PageHeader } from "@/components/layout/page-header";
import { FeedbackForm } from "@/components/feedback-form";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AppFeedback } from "@/types/database";

export default async function FeedbackPage() {
  const { user } = await getSessionProfile();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("app_feedback")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(3);

  const recent = (data ?? []) as AppFeedback[];

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
