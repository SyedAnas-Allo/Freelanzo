import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSessionProfile } from "@/lib/auth";
import { loadJobChatUnreadTotal } from "@/lib/load-job-chats";
import { createClient } from "@/lib/supabase/server";
import type { UserMode } from "@/types/database";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getSessionProfile();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const [{ count }, messageUnreadCount] = await Promise.all([
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null),
    loadJobChatUnreadTotal(supabase),
  ]);

  const mode = (profile?.active_mode ?? "freelancer") as UserMode;

  return (
    <AppShell
      unreadCount={count ?? 0}
      messageUnreadCount={messageUnreadCount}
      mode={mode}
    >
      {children}
    </AppShell>
  );
}
