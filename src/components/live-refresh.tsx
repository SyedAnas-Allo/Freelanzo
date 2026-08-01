"use client";

import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";

/** Client boundary that refreshes the current RSC tree when a table changes. */
export function LiveRefresh({
  channelName,
  table,
  event = "INSERT",
  filter,
  enabled = true,
  children,
}: {
  channelName: string;
  table: string;
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
  filter?: string;
  enabled?: boolean;
  children: React.ReactNode;
}) {
  useRealtimeRefresh({ channelName, table, event, filter, enabled });
  return children;
}
