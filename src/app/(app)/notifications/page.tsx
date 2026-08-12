"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "@/hooks/use-app-router";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageBack } from "@/components/page-back";
import { PageLoading } from "@/components/page-loading";
import { Button } from "@/components/ui/button";
import { NotificationSection } from "@/features/notifications/components/notification-section";
import { createClient } from "@/lib/supabase/client";
import type { Notification, Profile, UserMode } from "@/types/database";

export default function NotificationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<UserMode>("freelancer");
  const [items, setItems] = useState<Notification[]>([]);
  const [dayAgo, setDayAgo] = useState(0);
  const [marking, setMarking] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    if (!user) {
      router.push("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("active_mode")
      .eq("id", user.id)
      .maybeSingle();
    const nextMode = ((profile as Pick<Profile, "active_mode"> | null)
      ?.active_mode ?? "freelancer") as UserMode;
    setMode(nextMode);

    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    setItems((data ?? []) as Notification[]);
    setDayAgo(Date.now() - 24 * 60 * 60 * 1000);
  }, [router]);

  useEffect(() => {
    async function init() {
      await load();
      setLoading(false);
    }
    void init();
  }, [load]);

  async function markAllRead() {
    setMarking(true);
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    if (!user) {
      setMarking(false);
      return;
    }

    const readAt = new Date().toISOString();
    await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("user_id", user.id)
      .is("read_at", null);

    setItems((prev) =>
      prev.map((n) => (n.read_at ? n : { ...n, read_at: readAt })),
    );
    setMarking(false);
  }

  if (loading) return <PageLoading />;

  const homeHref = mode === "business" ? "/business" : "/freelancer";
  const newer = items.filter((n) => new Date(n.created_at).getTime() >= dayAgo);
  const earlier = items.filter((n) => new Date(n.created_at).getTime() < dayAgo);

  return (
    <div className="px-4">
      <PageBack href={homeHref} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">Notifications</h1>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-primary"
          disabled={marking}
          onClick={() => {
            void markAllRead();
          }}
        >
          Mark all as read
        </Button>
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
