export const SITE_URL = "https://freelanzo-three.vercel.app";

export function jobShareUrl(jobId: string) {
  return `${SITE_URL}/freelancer/jobs/${jobId}`;
}

type NativeShareWindow = Window & {
  __FREELANZO_NATIVE_SHARE__?: boolean;
  ReactNativeWebView?: { postMessage: (msg: string) => void };
};

/**
 * WebViews either hide navigator.share or reject it, so the Expo shell owns the
 * share sheet. The flag is set by app builds that handle the SHARE message —
 * older builds fall through to copying instead of silently doing nothing.
 */
function postNativeShare(payload: {
  url: string;
  title?: string;
  text?: string;
}): boolean {
  if (typeof window === "undefined") return false;
  const w = window as NativeShareWindow;
  if (!w.__FREELANZO_NATIVE_SHARE__ || !w.ReactNativeWebView) return false;
  w.ReactNativeWebView.postMessage(JSON.stringify({ type: "SHARE", ...payload }));
  return true;
}

function copyWithSelection(text: string): boolean {
  if (typeof document === "undefined") return false;
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.top = "0";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  field.setSelectionRange(0, text.length);
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  field.remove();
  return copied;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Blocked clipboard permission — fall through to the selection copy.
  }
  return copyWithSelection(text);
}

/** Prefer the native share sheet, then Web Share, then copying the URL. */
export async function shareOrCopy({
  url,
  title,
  text,
}: {
  url: string;
  title?: string;
  text?: string;
}): Promise<"shared" | "copied"> {
  if (postNativeShare({ url, title, text })) return "shared";

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ url, title, text });
      return "shared";
    } catch (error) {
      // User cancelled — don't treat as failure or fall through to copy.
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
    }
  }

  if (await copyToClipboard(url)) return "copied";
  throw new Error("Sharing and copying are both unavailable");
}
