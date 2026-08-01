"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

/**
 * Subscribes to Supabase postgres_changes and invokes onEvent (debounced).
 * Use on screens that need live client state (attendance, message list).
 * Prefer this over always-on app-wide sockets — mount only while the page is open.
 */
export function useRealtimeRefresh({
  channelName,
  table,
  event = "INSERT",
  filter,
  enabled = true,
  debounceMs = 300,
  onEvent,
}: {
  channelName: string;
  table: string;
  event?: RealtimeEvent;
  filter?: string;
  enabled?: boolean;
  debounceMs?: number;
  onEvent: () => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fire = useEffectEvent(onEvent);

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();

    const schedule = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        fire();
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
        schedule,
      )
      .subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      void supabase.removeChannel(channel);
    };
  }, [channelName, table, event, filter, enabled, debounceMs]);
}
