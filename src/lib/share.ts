export const SITE_URL = "https://freelanzo-three.vercel.app";

export function jobShareUrl(jobId: string) {
  return `${SITE_URL}/freelancer/jobs/${jobId}`;
}

/** Prefer the Web Share API; fall back to copying the URL. */
export async function shareOrCopy({
  url,
  title,
  text,
}: {
  url: string;
  title?: string;
  text?: string;
}): Promise<"shared" | "copied"> {
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

  await navigator.clipboard.writeText(url);
  return "copied";
}
