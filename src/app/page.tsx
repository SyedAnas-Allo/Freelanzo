"use client";

import { useEffect } from "react";
import { PageLoading } from "@/components/page-loading";
import { fetchSessionProfile } from "@/hooks/use-session-profile";
import { useRouter } from "@/hooks/use-app-router";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    void (async () => {
      const { user, profile } = await fetchSessionProfile();
      if (!user) {
        router.replace("/login");
        return;
      }
      // Middleware sends users without a session role pick to /continue.
      if (profile?.active_mode === "business") {
        router.replace("/business");
        return;
      }
      router.replace("/freelancer");
    })();
  }, [router]);

  return <PageLoading />;
}
