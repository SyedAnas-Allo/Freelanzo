"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

/**
 * Subscribes to Supabase postgres_changes and calls router.refresh().
 * Use on screens that need live SSR props (attendance, message list).
 * Prefer this over always-on app-wide sockets — mount only while the page is open.
 */
export function useRealtimeRefresh({
  channelName,
  table,
  event = "INSERT",
  filter,
  enabled = true,
  debounceMs = 300,
}: {
  channelName: string;
  table: string;
  event?: RealtimeEvent;
  filter?: string;
  enabled?: boolean;
  debounceMs?: number;
}) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();

    const scheduleRefresh = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        router.refresh();
      }, debounceMs);
    };

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event,
          schema: "public",
          table,
          ...(filter ? { filter } : {}),
        },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      void supabase.removeChannel(channel);
    };
  }, [channelName, table, event, filter, enabled, debounceMs, router]);
}
