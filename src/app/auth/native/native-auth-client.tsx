"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { classifyAppError } from "@/lib/app-errors";
import { clearRoleReadyCookie } from "@/lib/role-session";
import { createClient } from "@/lib/supabase/client";
import {
  completeNativeOAuth,
  readNativeHandoffParams,
  waitForNativeSession,
} from "@/lib/supabase/native-auth";

function goContinue() {
  clearRoleReadyCookie();
  // Full navigation so middleware reliably sees freshly set auth cookies.
  window.location.replace("/continue");
}

/**
 * Native handoff page (runs inside the app WebView).
 * Exchanges the OAuth `code` using localStorage PKCE (cookies are cleared when
 * Custom Tabs background the WebView). Also supports legacy token handoff.
 *
 * Never surface a credentials error if a session already exists or is still
 * landing from an in-flight exchange.
 */
export default function NativeAuthPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const finish = () => {
        if (cancelled) return;
        goContinue();
      };

      const failOnlyIfSignedOut = async (err: unknown) => {
        const session = await waitForNativeSession();
        if (cancelled) return;
        if (session) {
          finish();
          return;
        }
        setError(
          err
            ? classifyAppError(err).message
            : "Sign-in didn’t finish. Please try again.",
        );
      };

      try {
        let { code, accessToken, refreshToken } = readNativeHandoffParams();

        // Deep link / WebView can land a tick before query params settle.
        if (!code && !(accessToken && refreshToken)) {
          await new Promise((r) => setTimeout(r, 400));
          if (cancelled) return;
          ({ code, accessToken, refreshToken } = readNativeHandoffParams());
        }

        if (code) {
          const { error: exchangeError } = await completeNativeOAuth(code);
          if (cancelled) {
            // Remount may have scrubbed the URL — that remount recovers via session.
            return;
          }
          if (exchangeError) {
            await failOnlyIfSignedOut(exchangeError);
            return;
          }
          finish();
          return;
        }

        if (accessToken && refreshToken) {
          // Avoid cookie-client auto-PKCE if a stale ?code= is still present.
          const { error: sessionError } = await createClient().auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (cancelled) return;
          if (sessionError) {
            await failOnlyIfSignedOut(sessionError);
            return;
          }
          finish();
          return;
        }

        // No credentials — wait for an in-flight handoff before erroring.
        await failOnlyIfSignedOut(null);
      } catch (err) {
        if (cancelled) return;
        await failOnlyIfSignedOut(err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
      <p className="text-sm text-muted-foreground">
        {error ? error : "Finishing sign-in…"}
      </p>
      {error ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login"
            className="text-sm font-semibold text-primary underline-offset-2 hover:underline"
          >
            Try again
          </Link>
        </div>
      ) : null}
    </div>
  );
}
