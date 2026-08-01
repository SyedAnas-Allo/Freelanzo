"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRouter } from "@/hooks/use-app-router";
import { JobChatRoom } from "@/components/job-chat-room";
import { PageLoading } from "@/components/page-loading";
import { Button } from "@/components/ui/button";
import {
  type ChatMessageView,
  type ChatParticipant,
} from "@/lib/chat";
import {
  loadJobChat,
  loadJobChatMessages,
  loadJobChatParticipants,
} from "@/lib/load-job-chats";
import { createClient } from "@/lib/supabase/client";
import type { JobChatDetail, Profile } from "@/types/database";

export default function MessageThreadPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const jobId = params.id;

  const [loading, setLoading] = useState(true);
  const [notFoundChat, setNotFoundChat] = useState(false);
  const [chat, setChat] = useState<JobChatDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [participants, setParticipants] = useState<ChatParticipant[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [jobHref, setJobHref] = useState("/messages");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("active_mode")
        .eq("id", user.id)
        .maybeSingle();
      const mode = (profile as Pick<Profile, "active_mode"> | null)?.active_mode;

      const nextChat = await loadJobChat(supabase, jobId);
      if (!nextChat) {
        setNotFoundChat(true);
        setLoading(false);
        return;
      }

      const [nextMessages, nextParticipants] = await Promise.all([
        loadJobChatMessages(supabase, nextChat.chat_id, user.id),
        loadJobChatParticipants(supabase, nextChat.chat_id, user.id),
      ]);

      setChat(nextChat);
      setMessages(nextMessages);
      setParticipants(nextParticipants);
      setCurrentUserId(user.id);
      setJobHref(
        mode === "business"
          ? `/business/jobs/${nextChat.job_id}/applicants`
          : `/freelancer/jobs/${nextChat.job_id}`,
      );
      setLoading(false);
    }
    void load();
  }, [jobId, router]);

  if (loading) return <PageLoading />;

  if (notFoundChat || !chat) {
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

  return (
    <JobChatRoom
      chat={chat}
      initialMessages={messages}
      participants={participants}
      currentUserId={currentUserId}
      jobHref={jobHref}
    />
  );
}
