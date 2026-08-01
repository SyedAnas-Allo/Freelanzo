"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MessageSquare, Search } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { LiveRefresh } from "@/components/live-refresh";
import { PageContent } from "@/components/layout/page-content";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoading } from "@/components/page-loading";
import { MessageThreadRow } from "@/components/message-thread-row";
import { Input } from "@/components/ui/input";
import {
  chatClosedLabel,
  filterChatSummaries,
  formatChatTime,
  jobChatHref,
} from "@/lib/chat";
import { loadJobChatSummaries } from "@/lib/load-job-chats";
import { createClient } from "@/lib/supabase/client";
import type { JobChatSummary } from "@/types/database";

export default function MessagesPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <MessagesPageInner />
    </Suspense>
  );
}

function MessagesPageInner() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const [summaries, setSummaries] = useState<JobChatSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const supabase = createClient();
    try {
      const next = await loadJobChatSummaries(supabase);
      setSummaries(next);
    } catch {
      setSummaries([]);
    }
  }, []);

  useEffect(() => {
    async function load() {
      await reload();
      setLoading(false);
    }
    void load();
  }, [reload]);

  if (loading) return <PageLoading />;

  const threads = filterChatSummaries(summaries, q);

  return (
    <LiveRefresh
      channelName="messages-list"
      table="job_messages"
      onEvent={() => {
        void reload();
      }}
    >
      <PageContent>
        <PageHeader
          title="Messages"
          description="Group chats for gigs you are on."
        />

        <form className="relative mt-4">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            aria-label="Search messages"
            defaultValue={q}
            placeholder="Search gig chats…"
            className="rounded-xl pl-9"
          />
        </form>

        <div className="mt-2">
          {threads.length === 0 ? (
            <EmptyState
              icon={<MessageSquare aria-hidden="true" className="size-5" />}
              title="No Gig Chats Yet"
              description="A group chat opens when a freelancer is accepted on a gig."
            />
          ) : (
            threads.map((t) => (
              <MessageThreadRow
                key={t.chat_id}
                href={jobChatHref(t.job_id)}
                name={t.job_title}
                preview={
                  t.last_message_body ??
                  (t.closed_at
                    ? chatClosedLabel(t.closed_reason)
                    : `Chat with ${t.business_name}`)
                }
                time={formatChatTime(t.last_message_at)}
                unread={t.unread_count}
                badge={
                  t.closed_at ? "Closed" : t.can_send ? "Gig" : "Read only"
                }
              />
            ))
          )}
        </div>
      </PageContent>
    </LiveRefresh>
  );
}
