"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "@/hooks/use-app-router";
import { EmptyState } from "@/components/feedback/empty-state";
import { LoadErrorCard } from "@/components/feedback/load-error-card";
import { PageBack } from "@/components/page-back";
import { PageLoading } from "@/components/page-loading";
import { Button } from "@/components/ui/button";
import { NotificationSection } from "@/features/notifications/components/notification-section";
import { useSessionProfile } from "@/hooks/use-session-profile";
import { requestBadgesRefresh } from "@/hooks/use-shell-refresh";
import { classifyAppError, withTransientRetry } from "@/lib/app-errors";
import {
  ensureOnlineForMutation,
  presentAppError,
} from "@/lib/flash-message";
import { createClient } from "@/lib/supabase/client";
import type { Notification, UserMode } from "@/types/database";

export default function NotificationsPage() {
  const router = useRouter();
  const {
    user,
    profile,
    loading: sessionLoading,
  } = useSessionProfile();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [items, setItems] = useState<Notification[]>([]);
  const [dayAgo, setDayAgo] = useState(0);
  const [marking, setMarking] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      await withTransientRetry(async () => {
        const supabase = createClient();
        if (!user) {
          router.push("/login");
          return;
        }

        const { data, error } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) throw error;

        setItems((data ?? []) as Notification[]);
        setDayAgo(Date.now() - 24 * 60 * 60 * 1000);
      });
    } catch (error) {
      const classified = classifyAppError(error);
      setLoadError(classified.message);
    }
  }, [router, user]);

  useEffect(() => {
    if (sessionLoading) return;
    async function init() {
      await load();
      setLoading(false);
    }
    void init();
  }, [load, sessionLoading]);

  async function markAllRead() {
    if (!ensureOnlineForMutation()) return;
    setMarking(true);
    const supabase = createClient();
    if (!user) {
      setMarking(false);
      return;
    }

    const readAt = new Date().toISOString();
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("user_id", user.id)
      .is("read_at", null);

    if (error) {
      presentAppError(error, { onRetry: () => void markAllRead() });
      setMarking(false);
      return;
    }

    setItems((prev) =>
      prev.map((n) => (n.read_at ? n : { ...n, read_at: readAt })),
    );
    requestBadgesRefresh({ unreadCount: 0 });
    setMarking(false);
  }

  if (sessionLoading || loading) return <PageLoading />;

  const mode = (profile?.active_mode ?? "freelancer") as UserMode;
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
          disabled={marking || items.length === 0}
          onClick={() => {
            void markAllRead();
          }}
        >
          Mark all as read
        </Button>
      </div>

      {loadError ? (
        <LoadErrorCard
          className="mt-8"
          description={loadError}
          onRetry={() => {
            setLoading(true);
            void load().finally(() => setLoading(false));
          }}
        />
      ) : items.length === 0 ? (
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
