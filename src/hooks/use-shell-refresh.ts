"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Keeps AppShell SSR badges (notifications, message unread) fresh without
 * a permanent Realtime socket: refresh on in-app navigation and when the
 * tab becomes visible again.
 */
export function useShellRefresh() {
  const router = useRouter();
  const pathname = usePathname();
  const skipPathRefresh = useRef(true);

  useEffect(() => {
    if (skipPathRefresh.current) {
      skipPathRefresh.current = false;
      return;
    }
    router.refresh();
  }, [pathname, router]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);
}
