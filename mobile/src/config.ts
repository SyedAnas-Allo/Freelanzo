/**
 * Website loaded inside the WebView.
 * Override with EXPO_PUBLIC_WEB_URL in mobile/.env for local Next.js.
 */
export const WEB_URL =
  process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, "") ??
  "https://freelanzo-three.vercel.app";

/** Appended to the WebView user agent so the site can detect the native shell. */
export const APP_USER_AGENT_TOKEN = "FreelanzoApp/1.0";

export const BRAND = {
  name: "Freelanzo",
  primary: "#5E2CED",
  background: "#F8F5FF",
} as const;
