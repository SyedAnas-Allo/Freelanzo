import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapJobMessage,
  type ChatMessageView,
  type ChatParticipant,
} from "@/lib/chat";
import type {
  JobChatDetail,
  JobChatMembership,
  JobChatMembershipRole,
  JobChatSummary,
  JobMessage,
  Profile,
} from "@/types/database";

export async function loadJobChatSummaries(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("list_job_chat_summaries");
  if (error) throw error;
  return (data ?? []) as JobChatSummary[];
}

export async function loadJobChatUnreadTotal(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("job_chat_unread_total");
  if (error) return 0;
  return (data as number | null) ?? 0;
}

export async function loadJobChat(
  supabase: SupabaseClient,
  jobId: string,
): Promise<JobChatDetail | null> {
  const { data, error } = await supabase.rpc("get_job_chat", {
    p_job_id: jobId,
  });
  if (error) throw error;
  const rows = (data ?? []) as JobChatDetail[];
  return rows[0] ?? null;
}

export async function loadJobChatMessages(
  supabase: SupabaseClient,
  chatId: string,
  currentUserId: string,
): Promise<ChatMessageView[]> {
  const { data: messages, error } = await supabase
    .from("job_messages")
    .select("id, chat_id, sender_id, body, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) throw error;

  const rows = (messages ?? []) as JobMessage[];
  const senderIds = [...new Set(rows.map((m) => m.sender_id))];

  let names = new Map<string, string | null>();
  if (senderIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", senderIds);
    names = new Map(
      ((profiles ?? []) as Pick<Profile, "id" | "full_name">[]).map((p) => [
        p.id,
        p.full_name,
      ]),
    );
  }

  return rows.map((m) =>
    mapJobMessage(m, currentUserId, names.get(m.sender_id) ?? null),
  );
}

export async function loadJobChatParticipants(
  supabase: SupabaseClient,
  chatId: string,
  currentUserId: string,
): Promise<ChatParticipant[]> {
  const { data: memberships, error } = await supabase
    .from("job_chat_memberships")
    .select("user_id, role, left_at, joined_at")
    .eq("chat_id", chatId)
    .order("joined_at", { ascending: true });

  if (error) throw error;

  const rows = (memberships ?? []) as Pick<
    JobChatMembership,
    "user_id" | "role" | "left_at" | "joined_at"
  >[];

  // Prefer the active row when a user rejoined; otherwise keep latest left row.
  const latestByUser = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const prev = latestByUser.get(row.user_id);
    if (!prev) {
      latestByUser.set(row.user_id, row);
      continue;
    }
    if (prev.left_at && !row.left_at) {
      latestByUser.set(row.user_id, row);
      continue;
    }
    if (!!prev.left_at === !!row.left_at) {
      latestByUser.set(row.user_id, row);
    }
  }

  const unique = [...latestByUser.values()];
  const userIds = unique.map((m) => m.user_id);
  if (userIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, photo_url")
    .in("id", userIds);

  const profileMap = new Map(
    (
      (profiles ?? []) as Pick<Profile, "id" | "full_name" | "photo_url">[]
    ).map((p) => [p.id, p]),
  );

  return unique
    .map((m) => {
      const profile = profileMap.get(m.user_id);
      const name = profile?.full_name?.trim() || "Member";
      return {
        userId: m.user_id,
        name,
        photoUrl: profile?.photo_url ?? null,
        role: m.role as JobChatMembershipRole,
        isActive: m.left_at == null,
        isMe: m.user_id === currentUserId,
      } satisfies ChatParticipant;
    })
    .sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      if (a.role !== b.role) {
        return a.role === "business_owner" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
}
