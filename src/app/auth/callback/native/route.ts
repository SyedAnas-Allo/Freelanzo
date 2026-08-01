import { finishNativeOAuth } from "../native-handoff";

/**
 * Dedicated mobile OAuth callback.
 * Prefer allowlisting this AND /auth/callback in Supabase Redirect URLs.
 */
export async function GET(request: Request) {
  return finishNativeOAuth(request, { forceNative: true });
}
