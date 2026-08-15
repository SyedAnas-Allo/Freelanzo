"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/hooks/use-app-router";
import { classifyAppError } from "@/lib/app-errors";
import { clearRoleReadyCookie } from "@/lib/role-session";
import { createClient } from "@/lib/supabase/client";
import { completeNativeOAuth } from "@/lib/supabase/native-auth";

/**
 * Native handoff page (runs inside the app WebView).
 * Exchanges the OAuth `code` using localStorage PKCE (cookies are cleared when
 * Custom Tabs background the WebView). Also supports legacy token handoff.
 */
export default function NativeAuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const code = searchParams.get("code");
  const accessToken = searchParams.get("access_token");
  const refreshToken = searchParams.get("refresh_token");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (code) {
        const { error: exchangeError } = await completeNativeOAuth(code);
        if (cancelled) return;
        if (exchangeError) {
          setError(classifyAppError(exchangeError).message);
          return;
        }
        clearRoleReadyCookie();
        router.replace("/continue");
        return;
      }

      if (accessToken && refreshToken) {
        const supabase = createClient();
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (cancelled) return;
        if (sessionError) {
          setError(classifyAppError(sessionError).message);
          return;
        }
        clearRoleReadyCookie();
        router.replace("/continue");
        return;
      }

      setError("Missing sign-in credentials");
    })();

    return () => {
      cancelled = true;
    };
  }, [router, code, accessToken, refreshToken]);

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
