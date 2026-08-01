"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

  useEffect(() => {
    const code = searchParams.get("code");
    const access_token = searchParams.get("access_token");
    const refresh_token = searchParams.get("refresh_token");

    let cancelled = false;

    void (async () => {
      if (code) {
        const { error: exchangeError } = await completeNativeOAuth(code);
        if (cancelled) return;
        if (exchangeError) {
          setError(exchangeError.message);
          return;
        }
        clearRoleReadyCookie();
        router.replace("/continue");
        return;
      }

      if (access_token && refresh_token) {
        const supabase = createClient();
        const { error: sessionError } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (cancelled) return;
        if (sessionError) {
          setError(sessionError.message);
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
  }, [router, searchParams]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-6 text-center">
      <p className="text-sm text-muted-foreground">
        {error ? `Sign-in failed: ${error}` : "Finishing sign-in…"}
      </p>
    </div>
  );
}
