import type {
  JobChatClosedReason,
  JobChatDetail,
  JobChatMembershipRole,
  JobChatSummary,
  JobMessage,
} from "@/types/database";

export type ChatMessageView = {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  isMine: boolean;
  senderName: string | null;
};

export type ChatParticipant = {
  userId: string;
  name: string;
  photoUrl: string | null;
  role: JobChatMembershipRole;
  isActive: boolean;
  isMe: boolean;
};

export type ChatMessagePart =
  | { type: "text"; value: string }
  | { type: "mention"; value: string; userId: string };

export type MentionQuery = {
  start: number;
  query: string;
};

export function jobChatHref(jobId: string) {
  return `/messages/${jobId}`;
}

export function chatClosedLabel(reason: JobChatClosedReason | null | undefined) {
  switch (reason) {
    case "payments_confirmed":
      return "Chat closed after payment";
    case "job_cancelled":
      return "Chat closed — gig cancelled";
    case "job_expired":
      return "Chat closed — gig expired";
    default:
      return "Chat closed";
  }
}

export function chatComposerDisabledReason(chat: {
  can_send: boolean;
  closed_at: string | null;
  closed_reason: JobChatClosedReason | null;
}) {
  if (chat.can_send) return null;
  if (chat.closed_at) return chatClosedLabel(chat.closed_reason);
  return "You can no longer send messages in this chat";
}

export function formatChatTime(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return date.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  if (isYesterday) return "Yesterday";

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

export function mapJobMessage(
  message: JobMessage,
  currentUserId: string,
  senderName?: string | null,
): ChatMessageView {
  return {
    id: message.id,
    senderId: message.sender_id,
    body: message.body,
    createdAt: message.created_at,
    isMine: message.sender_id === currentUserId,
    senderName: senderName ?? null,
  };
}

/** Merge remote messages with optimistic ones; prefer server ids. */
export function mergeChatMessages(
  current: ChatMessageView[],
  incoming: ChatMessageView[],
): ChatMessageView[] {
  const byId = new Map<string, ChatMessageView>();
  for (const message of current) byId.set(message.id, message);
  for (const message of incoming) byId.set(message.id, message);

  return [...byId.values()].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
}

export function filterChatSummaries(
  summaries: JobChatSummary[],
  query: string,
) {
  const needle = query.trim().toLowerCase();
  if (!needle) return summaries;
  return summaries.filter(
    (s) =>
      s.job_title.toLowerCase().includes(needle) ||
      s.business_name.toLowerCase().includes(needle) ||
      (s.last_message_body ?? "").toLowerCase().includes(needle),
  );
}

export function chatRoomTitle(chat: Pick<JobChatDetail, "job_title" | "business_name">) {
  return chat.job_title;
}

export function chatRoomSubtitle(
  chat: Pick<JobChatDetail, "business_name" | "member_count" | "closed_at">,
) {
  if (chat.closed_at) return "Read only";
  const members = Math.max(0, chat.member_count);
  return `${chat.business_name} · ${members} member${members === 1 ? "" : "s"}`;
}

export function chatRoleLabel(role: JobChatMembershipRole) {
  return role === "business_owner" ? "Business" : "Freelancer";
}

export function participantInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Stable @handle used in message body (plain text, no schema change). */
export function mentionHandle(participant: ChatParticipant) {
  const cleaned = participant.name.trim().replace(/\s+/g, " ");
  return cleaned || "Member";
}

export function mentionToken(participant: ChatParticipant) {
  return `@${mentionHandle(participant)}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Detect `@query` immediately before the cursor for autocomplete. */
export function getMentionQuery(
  text: string,
  cursor: number,
): MentionQuery | null {
  const head = text.slice(0, Math.max(0, cursor));
  const match = /(?:^|[\s([{])@([^\s@]*)$/.exec(head);
  if (!match) return null;
  const query = match[1] ?? "";
  const start = head.length - query.length - 1;
  return { start, query };
}

export function filterMentionCandidates(
  participants: ChatParticipant[],
  query: string,
  excludeUserId?: string,
) {
  const needle = query.trim().toLowerCase();
  return participants
    .filter((p) => p.isActive && p.userId !== excludeUserId)
    .filter((p) => {
      if (!needle) return true;
      return (
        p.name.toLowerCase().includes(needle) ||
        mentionHandle(p).toLowerCase().includes(needle) ||
        chatRoleLabel(p.role).toLowerCase().includes(needle)
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function insertMention(
  text: string,
  cursor: number,
  participant: ChatParticipant,
): { text: string; cursor: number } {
  const mention = getMentionQuery(text, cursor);
  const token = `${mentionToken(participant)} `;
  if (!mention) {
    const prefix = text.slice(0, cursor);
    const needsSpace = prefix.length > 0 && !/\s$/.test(prefix);
    const insertion = `${needsSpace ? " " : ""}${token}`;
    const next = `${prefix}${insertion}${text.slice(cursor)}`;
    const nextCursor = prefix.length + insertion.length;
    return { text: next, cursor: nextCursor };
  }

  const next = `${text.slice(0, mention.start)}${token}${text.slice(cursor)}`;
  const nextCursor = mention.start + token.length;
  return { text: next, cursor: nextCursor };
}

export function addressParticipant(
  text: string,
  participant: ChatParticipant,
): string {
  const token = mentionToken(participant);
  const trimmed = text.trimStart();
  if (trimmed.startsWith(`${token} `) || trimmed === token) return text;
  if (!text.trim()) return `${token} `;
  return `${token} ${text.trimStart()}`;
}

export function parseMessageParts(
  body: string,
  participants: ChatParticipant[],
): ChatMessagePart[] {
  const byHandle = new Map<string, ChatParticipant>();
  for (const participant of participants) {
    const handle = mentionHandle(participant);
    if (!handle) continue;
    if (!byHandle.has(handle.toLowerCase())) {
      byHandle.set(handle.toLowerCase(), participant);
    }
  }
  const handles = [...byHandle.values()].sort(
    (a, b) => mentionHandle(b).length - mentionHandle(a).length,
  );

  if (handles.length === 0) return [{ type: "text", value: body }];

  const pattern = new RegExp(
    `@(?:${handles.map((p) => escapeRegExp(mentionHandle(p))).join("|")})(?![\\w])`,
    "g",
  );

  const parts: ChatMessagePart[] = [];
  let lastIndex = 0;
  for (const match of body.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ type: "text", value: body.slice(lastIndex, index) });
    }
    const raw = match[0];
    const handle = raw.slice(1);
    const participant = handles.find(
      (p) => mentionHandle(p).toLowerCase() === handle.toLowerCase(),
    );
    if (participant) {
      parts.push({
        type: "mention",
        value: raw,
        userId: participant.userId,
      });
    } else {
      parts.push({ type: "text", value: raw });
    }
    lastIndex = index + raw.length;
  }
  if (lastIndex < body.length) {
    parts.push({ type: "text", value: body.slice(lastIndex) });
  }
  return parts.length > 0 ? parts : [{ type: "text", value: body }];
}

export function sameChatDay(a: string, b: string) {
  const left = new Date(a);
  const right = new Date(b);
  if (Number.isNaN(left.getTime()) || Number.isNaN(right.getTime())) return false;
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function formatChatDayLabel(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) return "Today";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();
  if (isYesterday) return "Yesterday";

  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function resolveSenderName(
  senderId: string,
  participants: ChatParticipant[],
  fallback: string | null = null,
) {
  return participants.find((p) => p.userId === senderId)?.name ?? fallback;
}
