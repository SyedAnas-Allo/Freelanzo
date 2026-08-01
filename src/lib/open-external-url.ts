import { toast } from "sonner";
import { telLink } from "@/lib/utils";

function isNativeWebView(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as Window & {
    __FREELANZO_NATIVE__?: boolean;
    ReactNativeWebView?: unknown;
  };
  return Boolean(w.__FREELANZO_NATIVE__ || w.ReactNativeWebView);
}

function isCoarseMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function postNativeOpenUrl(url: string): boolean {
  const w = window as Window & {
    ReactNativeWebView?: { postMessage: (msg: string) => void };
  };
  if (!w.ReactNativeWebView) return false;
  w.ReactNativeWebView.postMessage(
    JSON.stringify({ type: "OPEN_URL", url }),
  );
  return true;
}

function showDialFallback(phone: string, reason?: string) {
  const label = phone.trim() || "number";
  void navigator.clipboard?.writeText(label).catch(() => undefined);
  toast.message(`Call ${label}`, {
    description:
      reason ??
      "If the dialer did not open, the number was copied — paste it in Phone.",
    duration: 10_000,
  });
}

/**
 * Open the device dialer for a phone number.
 * Works in mobile browsers; in the Expo WebView posts OPEN_URL to native.
 * Always surfaces a copy fallback so a dead dialer never feels like a no-op.
 */
export function dialPhone(phone: string) {
  const href = telLink(phone);
  const display = phone.replace(/[^\d+]/g, "") || phone;

  if (typeof window === "undefined") return;

  if (isNativeWebView()) {
    postNativeOpenUrl(href);
    // Older app builds may ignore OPEN_URL — always offer a visible fallback.
    showDialFallback(
      display,
      "Opening dialer… If nothing happens, the number was copied.",
    );
    return;
  }

  try {
    window.location.href = href;
  } catch {
    // ignore
  }

  // Desktop / tablets without a dialer: tel: is often a silent no-op.
  if (!isCoarseMobile()) {
    showDialFallback(
      display,
      "Open Freelanzo on your phone to dial, or paste the copied number.",
    );
  }
}

/** @deprecated Prefer dialPhone — kept for non-tel external schemes. */
export function openExternalUrl(url: string) {
  if (typeof window === "undefined") return;

  if (url.startsWith("tel:")) {
    dialPhone(url.slice(4));
    return;
  }

  if (postNativeOpenUrl(url)) return;
  window.location.assign(url);
}
