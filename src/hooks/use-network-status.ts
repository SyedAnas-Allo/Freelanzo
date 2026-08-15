"use client";

import { useEffect, useEffectEvent, useState } from "react";
import {
  readNativeOnlineFlag,
  setNativeOnlineFlag,
} from "@/lib/app-errors";

export const NETWORK_CHANGE_EVENT = "freelanzo-network-change";

export type NetworkChangeDetail = {
  online: boolean;
  /** Set by the Expo shell so listeners can treat NetInfo as authoritative. */
  native?: boolean;
};

declare global {
  interface WindowEventMap {
    [NETWORK_CHANGE_EVENT]: CustomEvent<NetworkChangeDetail>;
  }
}

export function dispatchNetworkChange(online: boolean, native = false) {
  if (typeof window === "undefined") return;
  if (native) setNativeOnlineFlag(online);
  window.dispatchEvent(
    new CustomEvent(NETWORK_CHANGE_EVENT, { detail: { online, native } }),
  );
}

function readBrowserOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  if (typeof navigator.onLine === "boolean") return navigator.onLine;
  return true;
}

/**
 * Combines browser online/offline events with native bridge updates.
 * Native NetInfo is authoritative inside the Expo WebView.
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const apply = useEffectEvent((online: boolean) => {
    setIsOnline((prev) => {
      if (prev && !online) setWasOffline(true);
      return online;
    });
  });

  useEffect(() => {
    function applyBrowser(online: boolean) {
      // NetInfo is the source of truth in the shell; navigator.onLine inside a
      // WebView reports stale values and would fight the native signal.
      if (readNativeOnlineFlag() !== null) return;
      apply(online);
    }
    function onOnline() {
      applyBrowser(true);
    }
    function onOffline() {
      applyBrowser(false);
    }
    function onNative(event: Event) {
      const detail = (event as CustomEvent<NetworkChangeDetail>).detail;
      if (typeof detail?.online !== "boolean") return;
      // Keep the shared flag in sync for non-React callers (mutation guards).
      if (detail.native !== false) setNativeOnlineFlag(detail.online);
      apply(detail.online);
    }

    // Defer initial sync so we don't cascade render from the effect body.
    const frame = window.requestAnimationFrame(() => {
      apply(readNativeOnlineFlag() ?? readBrowserOnline());
      setHydrated(true);
    });

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener(NETWORK_CHANGE_EVENT, onNative);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener(NETWORK_CHANGE_EVENT, onNative);
    };
  }, []);

  return { isOnline, wasOffline, hydrated };
}
