import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/env";

export function createClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    realtime: {
      // Heartbeats in a worker so iOS/Android WebView background throttling
      // does not silently kill postgres_changes (chat, attendance, messages).
      worker: true,
      heartbeatIntervalMs: 15_000,
    },
  });
}
