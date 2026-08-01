"use client";

import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";

/** Subscribes to a table and calls onEvent when rows change. */
export function LiveRefresh({
  channelName,
  table,
  event = "INSERT",
  filter,
  enabled = true,
  onEvent,
  children,
}: {
  channelName: string;
  table: string;
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
  filter?: string;
  enabled?: boolean;
  onEvent: () => void;
  children: React.ReactNode;
}) {
  useRealtimeRefresh({ channelName, table, event, filter, enabled, onEvent });
  return children;
}
