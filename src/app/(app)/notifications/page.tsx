import { redirect } from "next/navigation";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageBack } from "@/components/page-back";
import { Button } from "@/components/ui/button";
import { NotificationSection } from "@/features/notifications/components/notification-section";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { markAllRead } from "./actions";
import type { Notification, UserMode } from "@/types/database";

export default async function NotificationsPage() {
  const { user, profile } = await getSessionProfile();
  if (!user) redirect("/login");

  const mode = (profile?.active_mode ?? "freelancer") as UserMode;
  const homeHref = mode === "business" ? "/business" : "/freelancer";

  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const items = (data ?? []) as Notification[];
  // Server-rendered request time is the intended boundary for the "New" group.
  // eslint-disable-next-line react-hooks/purity
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const newer = items.filter((n) => new Date(n.created_at).getTime() >= dayAgo);
  const earlier = items.filter((n) => new Date(n.created_at).getTime() < dayAgo);

  return (
    <div className="px-4 py-4">
      <PageBack href={homeHref} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">Notifications</h1>
        <form action={markAllRead}>
          <Button type="submit" variant="ghost" size="sm" className="text-primary">
            Mark all as read
          </Button>
        </form>
      </div>

      {items.length === 0 ? (
        <EmptyState
          className="mt-8 p-8"
          title="You're all caught up"
          description="Applications, check-ins, and payments will show up here."
        />
      ) : (
        <>
          <NotificationSection title="New" rows={newer} mode={mode} />
          <NotificationSection title="Earlier" rows={earlier} mode={mode} />
        </>
      )}
    </div>
  );
}
