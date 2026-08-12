"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

const FOREGROUND_EVENT = "freelanzo-foreground";

/**
 * Subscribes to Supabase postgres_changes and invokes onEvent (debounced).
 * Use on screens that need live client state (attendance, message list).
 *
 * WebView-safe: re-auth + reconnect on foreground/visibility, and optional
 * polling fallback when sockets die silently in the app shell.
 */
export function useRealtimeRefresh({
  channelName,
  table,
  event = "INSERT",
  filter,
  enabled = true,
  debounceMs = 300,
  /** Poll while visible — covers silent WebView websocket drops. */
  pollIntervalMs = 5_000,
  onEvent,
}: {
  channelName: string;
  table: string;
  event?: RealtimeEvent;
  filter?: string;
  enabled?: boolean;
  debounceMs?: number;
  pollIntervalMs?: number | null;
  onEvent: () => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fire = useEffectEvent(onEvent);
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    function bump() {
      const supabase = createClient();
      try {
        supabase.realtime.connect();
      } catch {
        // ignore
      }
      setEpoch((n) => n + 1);
      fire();
    }

    function onVisible() {
      if (document.visibilityState === "visible") bump();
    }

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(FOREGROUND_EVENT, bump);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(FOREGROUND_EVENT, bump);
    };
  }, []);

  useEffect(() => {
    if (!enabled || !pollIntervalMs || pollIntervalMs < 1_000) return;

    const id = setInterval(() => {
      if (document.visibilityState === "visible") fire();
    }, pollIntervalMs);

    return () => clearInterval(id);
  }, [enabled, pollIntervalMs]);

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();
    let cancelled = false;

    const schedule = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        fire();
      }, debounceMs);
    };

    async function subscribe() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }
      if (cancelled) return;

      const channel = supabase
        .channel(`${channelName}:${epoch}`)
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
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            try {
              supabase.realtime.connect();
            } catch {
              // ignore
            }
          }
        });

      return channel;
    }

    let channel: ReturnType<typeof supabase.channel> | undefined;
    void subscribe().then((ch) => {
      channel = ch;
    });

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [channelName, table, event, filter, enabled, debounceMs, epoch]);
}
