"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AtSign,
  Copy,
  MoreHorizontal,
  Send,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { ChatMessageBody } from "@/components/chat-message-body";
import { ChatParticipantsSheet } from "@/components/chat-participants-sheet";
import { PageBack } from "@/components/page-back";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import {
  addressParticipant,
  chatComposerDisabledReason,
  chatRoomSubtitle,
  chatRoomTitle,
  filterMentionCandidates,
  formatChatDayLabel,
  formatChatTime,
  getMentionQuery,
  insertMention,
  mergeChatMessages,
  resolveSenderName,
  sameChatDay,
  type ChatMessageView,
  type ChatParticipant,
} from "@/lib/chat";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { JobChatDetail, JobMessage } from "@/types/database";

export function JobChatRoom({
  chat,
  initialMessages,
  participants,
  currentUserId,
  jobHref,
}: {
  chat: JobChatDetail;
  initialMessages: ChatMessageView[];
  participants: ChatParticipant[];
  currentUserId: string;
  jobHref: string;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [mentionIndex, setMentionIndex] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const disabledReason = useMemo(
    () => chatComposerDisabledReason(chat),
    [chat],
  );

  const participantById = useMemo(() => {
    const map = new Map<string, ChatParticipant>();
    for (const p of participants) map.set(p.userId, p);
    return map;
  }, [participants]);

  const mentionQuery = useMemo(
    () => (disabledReason ? null : getMentionQuery(text, cursor)),
    [text, cursor, disabledReason],
  );

  const mentionCandidates = useMemo(() => {
    if (!mentionQuery) return [];
    return filterMentionCandidates(
      participants,
      mentionQuery.query,
      currentUserId,
    );
  }, [mentionQuery, participants, currentUserId]);

  const mentionResetKey = `${mentionQuery?.start ?? ""}:${mentionQuery?.query ?? ""}:${mentionCandidates.length}`;
  const [lastMentionResetKey, setLastMentionResetKey] = useState(mentionResetKey);
  if (mentionResetKey !== lastMentionResetKey) {
    setLastMentionResetKey(mentionResetKey);
    setMentionIndex(0);
  }

  const markRead = useCallback(async () => {
    const supabase = createClient();
    await supabase.rpc("mark_job_chat_read", { p_job_id: chat.job_id });
  }, [chat.job_id]);

  useEffect(() => {
    void markRead();
  }, [markRead, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Keep last timestamp for poll catch-up (WebView sockets often die quietly).
  const newestAt = messages.length
    ? messages.reduce(
        (best, m) => (m.createdAt > best ? m.createdAt : best),
        messages[0]!.createdAt,
      )
    : null;
  const newestAtRef = useRef(newestAt);
  newestAtRef.current = newestAt;

  const ingestRows = useCallback(
    (rows: JobMessage[]) => {
      if (!rows.length) return;
      setMessages((prev) =>
        mergeChatMessages(
          prev,
          rows.map((row) => ({
            id: row.id,
            senderId: row.sender_id,
            body: row.body,
            createdAt: row.created_at,
            isMine: row.sender_id === currentUserId,
            senderName:
              resolveSenderName(row.sender_id, participants) ?? null,
          })),
        ),
      );
    },
    [currentUserId, participants],
  );

  const pullLatest = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    const supabase = createClient();
    let query = supabase
      .from("job_messages")
      .select("id, chat_id, sender_id, body, created_at")
      .eq("chat_id", chat.chat_id)
      .order("created_at", { ascending: true })
      .limit(50);
    const since = newestAtRef.current;
    if (since) query = query.gt("created_at", since);
    const { data } = await query;
    if (data?.length) ingestRows(data as JobMessage[]);
  }, [chat.chat_id, ingestRows]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | undefined;

    async function subscribe(epoch: number) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }
      if (cancelled) return;

      channel = supabase
        .channel(`job-chat:${chat.chat_id}:${epoch}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "job_messages",
            filter: `chat_id=eq.${chat.chat_id}`,
          },
          (payload) => {
            ingestRows([payload.new as JobMessage]);
          },
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            try {
              supabase.realtime.connect();
            } catch {
              // ignore
            }
          }
        });
    }

    let epoch = 0;
    void subscribe(epoch);

    function onForeground() {
      try {
        supabase.realtime.connect();
      } catch {
        // ignore
      }
      epoch += 1;
      if (channel) void supabase.removeChannel(channel);
      void subscribe(epoch);
      void pullLatest();
    }

    function onVisible() {
      if (document.visibilityState === "visible") onForeground();
    }

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("freelanzo-foreground", onForeground);
    const poll = setInterval(() => {
      void pullLatest();
    }, 3_500);

    return () => {
      cancelled = true;
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("freelanzo-foreground", onForeground);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [chat.chat_id, ingestRows, pullLatest]);

  function focusComposer(nextText: string, nextCursor: number) {
    setText(nextText);
    setCursor(nextCursor);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(nextCursor, nextCursor);
    });
  }

  function applyMention(participant: ChatParticipant) {
    const result = insertMention(text, cursor, participant);
    focusComposer(result.text, result.cursor);
  }

  function address(participant: ChatParticipant) {
    if (disabledReason || participant.isMe) return;
    const next = addressParticipant(text, participant);
    focusComposer(next, next.length);
  }

  async function copyMessage(body: string) {
    try {
      await navigator.clipboard.writeText(body);
      toast.success("Message copied");
    } catch {
      toast.error("Could not copy message");
    }
  }

  async function send() {
    const body = text.trim();
    if (!body || sending || disabledReason) return;

    setSending(true);
    const optimisticId = `local-${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();
    setMessages((prev) =>
      mergeChatMessages(prev, [
        {
          id: optimisticId,
          senderId: currentUserId,
          body,
          createdAt,
          isMine: true,
          senderName: null,
        },
      ]),
    );
    setText("");
    setCursor(0);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("job_messages")
      .insert({
        chat_id: chat.chat_id,
        sender_id: currentUserId,
        body,
      })
      .select("id, chat_id, sender_id, body, created_at")
      .single();

    if (error || !data) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setText(body);
      setCursor(body.length);
      toast.error(error?.message || "Could not send message");
      setSending(false);
      return;
    }

    const saved = data as JobMessage;
    setMessages((prev) =>
      mergeChatMessages(
        prev.filter((m) => m.id !== optimisticId),
        [
          {
            id: saved.id,
            senderId: saved.sender_id,
            body: saved.body,
            createdAt: saved.created_at,
            isMine: true,
            senderName: null,
          },
        ],
      ),
    );
    setSending(false);
  }

  return (
    <div className="flex h-[calc(100dvh-3.25rem)] flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-4 py-3">
        <PageBack href="/messages" iconOnly />
        <button
          type="button"
          className="min-w-0 flex-1 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setParticipantsOpen(true)}
        >
          <p className="truncate text-sm font-bold">{chatRoomTitle(chat)}</p>
          <p className="truncate text-[11px] font-light text-muted-foreground">
            {chatRoomSubtitle(chat)}
          </p>
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0"
          aria-label="View participants"
          onClick={() => setParticipantsOpen(true)}
        >
          <Users className="size-4" />
        </Button>
        <Button variant="ghost" size="sm" className="shrink-0 px-2" asChild>
          <Link href={jobHref}>Gig</Link>
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm font-light text-muted-foreground">
            Gig group chat for {chat.business_name}. Messages are visible to the
            business and accepted freelancers. Type @ to address someone.
          </p>
        ) : (
          messages.map((m, index) => {
            const prev = messages[index - 1];
            const showDay =
              !prev || !sameChatDay(prev.createdAt, m.createdAt);
            const sender =
              !m.isMine
                ? m.senderName ??
                  participantById.get(m.senderId)?.name ??
                  null
                : null;
            const addressTarget = participantById.get(m.senderId);

            return (
              <div key={m.id} className="space-y-3">
                {showDay ? (
                  <div className="flex justify-center">
                    <span className="rounded-full bg-muted/80 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {formatChatDayLabel(m.createdAt)}
                    </span>
                  </div>
                ) : null}
                <div
                  className={cn(
                    "flex",
                    m.isMine ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "relative max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
                      m.isMine
                        ? "rounded-br-md bg-primary text-primary-foreground"
                        : "rounded-bl-md bg-secondary text-foreground",
                    )}
                  >
                    <div className="absolute top-0.5 right-0.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "size-7 rounded-lg opacity-60 hover:opacity-100",
                              m.isMine
                                ? "text-primary-foreground/80 hover:bg-primary-foreground/15 hover:text-primary-foreground"
                                : "text-muted-foreground hover:bg-background/60",
                            )}
                            aria-label="Message options"
                          >
                            <MoreHorizontal className="size-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-40">
                          <DropdownMenuItem
                            onClick={() => void copyMessage(m.body)}
                          >
                            <Copy className="size-3.5" />
                            Copy
                          </DropdownMenuItem>
                          {!m.isMine &&
                          addressTarget &&
                          !disabledReason &&
                          addressTarget.isActive ? (
                            <DropdownMenuItem
                              onClick={() => address(addressTarget)}
                            >
                              <AtSign className="size-3.5" />
                              Address @{addressTarget.name.split(" ")[0]}
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {sender ? (
                      <button
                        type="button"
                        className="mb-0.5 block max-w-full truncate text-left text-[10px] font-semibold opacity-70 hover:opacity-100"
                        disabled={!!disabledReason || !addressTarget?.isActive}
                        onClick={() => {
                          if (addressTarget) address(addressTarget);
                        }}
                      >
                        {sender}
                      </button>
                    ) : null}
                    <ChatMessageBody
                      body={m.body}
                      participants={participants}
                      isMine={m.isMine}
                      className="pr-5"
                    />
                    <p
                      className={cn(
                        "mt-1 text-[10px]",
                        m.isMine
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground",
                      )}
                    >
                      {formatChatTime(m.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-border/60 bg-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {disabledReason ? (
          <p className="rounded-xl bg-muted/60 px-3 py-2.5 text-center text-xs font-medium text-muted-foreground">
            {disabledReason}
          </p>
        ) : (
          <div className="relative">
            {mentionCandidates.length > 0 ? (
              <div className="absolute inset-x-0 bottom-full z-10 mb-2 overflow-hidden rounded-xl border border-border/70 bg-popover shadow-lg">
                <p className="border-b border-border/60 px-3 py-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                  Address someone
                </p>
                <ul className="max-h-44 overflow-y-auto py-1">
                  {mentionCandidates.map((p, index) => (
                    <li key={p.userId}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60",
                          index === mentionIndex ? "bg-muted/70" : null,
                        )}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          applyMention(p);
                        }}
                      >
                        <AtSign className="size-3.5 shrink-0 text-primary" />
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {p.name}
                        </span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {p.role === "business_owner"
                            ? "Business"
                            : "Freelancer"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex items-end gap-2">
              <Textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setCursor(e.target.selectionStart);
                }}
                onSelect={(e) => {
                  setCursor(e.currentTarget.selectionStart);
                }}
                onClick={(e) => {
                  setCursor(e.currentTarget.selectionStart);
                }}
                placeholder="Message the gig group… Use @ to tag"
                rows={1}
                maxLength={2000}
                className="max-h-32 min-h-10 resize-none rounded-xl py-2.5"
                onKeyDown={(e) => {
                  if (mentionCandidates.length > 0) {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setMentionIndex(
                        (i) => (i + 1) % mentionCandidates.length,
                      );
                      return;
                    }
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setMentionIndex(
                        (i) =>
                          (i - 1 + mentionCandidates.length) %
                          mentionCandidates.length,
                      );
                      return;
                    }
                    if (e.key === "Enter" || e.key === "Tab") {
                      e.preventDefault();
                      const chosen =
                        mentionCandidates[mentionIndex] ??
                        mentionCandidates[0];
                      if (chosen) applyMention(chosen);
                      return;
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setCursor(text.length);
                      // Break the mention by moving past incomplete @query without changing text:
                      // append a zero-width no-break? Simpler: just close by appending space after @
                      const q = getMentionQuery(text, cursor);
                      if (q) {
                        const next = `${text.slice(0, q.start + 1 + q.query.length)} ${text.slice(cursor)}`;
                        focusComposer(next, q.start + 1 + q.query.length + 1);
                      }
                      return;
                    }
                  }

                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <Button
                size="icon"
                className="mb-0.5 size-10 shrink-0 rounded-xl"
                disabled={sending || !text.trim()}
                onClick={() => void send()}
              >
                <Send className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <ChatParticipantsSheet
        open={participantsOpen}
        onOpenChange={setParticipantsOpen}
        participants={participants}
        canAddress={!disabledReason}
        onAddress={address}
      />
    </div>
  );
}
