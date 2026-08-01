"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Receives access/refresh tokens from the native deep-link handoff and
 * establishes the session inside the WebView cookie jar.
 */
export default function NativeAuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const access_token = searchParams.get("access_token");
    const refresh_token = searchParams.get("refresh_token");

    if (!access_token || !refresh_token) {
      setError("Missing session tokens");
      return;
    }

    let cancelled = false;

    void (async () => {
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
      router.replace("/continue");
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
