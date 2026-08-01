import Link from "next/link";
import { redirect } from "next/navigation";
import { JobChatRoom } from "@/components/job-chat-room";
import { Button } from "@/components/ui/button";
import { getSessionProfile } from "@/lib/auth";
import {
  loadJobChat,
  loadJobChatMessages,
  loadJobChatParticipants,
} from "@/lib/load-job-chats";
import { createClient } from "@/lib/supabase/server";

export default async function MessageThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: jobId } = await params;
  const { user, profile } = await getSessionProfile();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const chat = await loadJobChat(supabase, jobId);
  if (!chat) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="font-bold">Conversation not found</p>
        <p className="mt-2 text-sm font-light text-muted-foreground">
          Gig chats open after a freelancer is accepted.
        </p>
        <Button className="mt-4" asChild>
          <Link href="/messages">Back to Messages</Link>
        </Button>
      </div>
    );
  }

  const [messages, participants] = await Promise.all([
    loadJobChatMessages(supabase, chat.chat_id, user.id),
    loadJobChatParticipants(supabase, chat.chat_id, user.id),
  ]);

  const jobHref =
    profile?.active_mode === "business"
      ? `/business/jobs/${chat.job_id}/applicants`
      : `/freelancer/jobs/${chat.job_id}`;

  return (
    <JobChatRoom
      chat={chat}
      initialMessages={messages}
      participants={participants}
      currentUserId={user.id}
      jobHref={jobHref}
    />
  );
}
