"use client";

import { useState } from "react";
import { Lock, Shield, Smartphone, Users } from "lucide-react";
import { toast } from "sonner";
import { LegalDocumentSheet } from "@/components/legal-document-sheet";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import type { LegalDocumentId } from "@/lib/legal";
import { clearRoleReadyCookie } from "@/lib/role-session";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [legalDoc, setLegalDoc] = useState<LegalDocumentId | null>(null);

  async function signInWithGoogle() {
    setLoading(true);
    clearRoleReadyCookie();
    const supabase = createClient();

    const w = window as Window & {
      __FREELANZO_NATIVE__?: boolean;
      ReactNativeWebView?: { postMessage: (msg: string) => void };
    };
    const isNative = Boolean(w.__FREELANZO_NATIVE__ || w.ReactNativeWebView);
    // Use /auth/callback?native=1 so existing Supabase allowlist entries work.
    const redirectTo = isNative
      ? `${window.location.origin}/auth/callback?native=1`
      : `${window.location.origin}/auth/callback`;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: isNative,
      },
    });

    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

    if (isNative && data?.url && w.ReactNativeWebView) {
      w.ReactNativeWebView.postMessage(
        JSON.stringify({ type: "OAUTH_START", url: data.url }),
      );
      return;
    }
  }

  return (
    <div className="relative flex min-h-dvh flex-col bg-gradient-to-b from-white via-[#F8F2FF] to-[#EDE0FF]">
      {/* Branding — compact so short phones keep room for the people strip */}
      <div className="relative z-10 shrink-0 flex flex-col items-center bg-gradient-to-b from-white to-[#F8F2FF] px-5 pb-1 pt-6 text-center">
        <Logo size="lg" className="justify-center" />
        <h1 className="mt-3 max-w-[18ch] font-heading text-xl font-extrabold leading-tight tracking-tight text-secondary-foreground sm:text-2xl">
          India’s On-Demand Local Freelancing Platform
        </h1>
        <p className="mt-1.5 max-w-[28ch] text-xs font-light text-muted-foreground sm:text-sm">
          Connecting businesses with trusted local freelancers nearby.
        </p>
      </div>

      {/*
        Artwork: fixed visible faces + overlap zone.
        Card pulls up only over the overlap zone, so faces stay on screen
        even when the viewport is short (page scrolls instead of crushing).
      */}
      <div className="relative mx-auto w-full max-w-[430px] shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/background.jpeg"
          alt=""
          className="pointer-events-none block h-[min(42vh,340px)] w-full object-cover object-[center_38%] select-none"
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-[#F8F2FF] to-transparent" />
      </div>

      <div className="relative z-20 -mt-14 flex flex-1 flex-col rounded-t-[28px] border border-b-0 bg-card px-5 pb-8 pt-5 shadow-[0_-8px_30px_rgba(142,48,255,0.08)] sm:-mt-20">
        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
          <Smartphone className="size-4" />
          Login / Sign Up
        </p>
        <h2 className="mt-2 text-lg font-extrabold">Continue with Google</h2>
        <p className="text-sm font-light text-muted-foreground">
          We’ll ask for your profile details when you apply or post a gig.
        </p>

        <Button
          className="mt-5 h-12 w-full rounded-xl text-base"
          onClick={signInWithGoogle}
          disabled={loading}
        >
          <GoogleIcon />
          {loading ? "Redirecting…" : "Continue with Google"}
        </Button>

        <div className="mt-5 flex justify-center gap-6 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Shield className="size-3.5 text-primary" /> Safe
          </span>
          <span className="inline-flex items-center gap-1">
            <Lock className="size-3.5 text-primary" /> Secure
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5 text-primary" /> Trusted
          </span>
        </div>
        <p className="mt-4 text-center text-[11px] font-light text-muted-foreground">
          By continuing, you agree to our{" "}
          <button
            type="button"
            className="font-semibold text-primary underline-offset-2 hover:underline"
            onClick={() => setLegalDoc("terms")}
          >
            Terms & Conditions
          </button>{" "}
          and{" "}
          <button
            type="button"
            className="font-semibold text-primary underline-offset-2 hover:underline"
            onClick={() => setLegalDoc("privacy")}
          >
            Privacy Policy
          </button>
        </p>
      </div>

      <LegalDocumentSheet
        documentId={legalDoc}
        open={legalDoc !== null}
        onOpenChange={(open) => {
          if (!open) setLegalDoc(null);
        }}
      />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.6h5.1c-.2 1.2-1.5 3.6-5.1 3.6-3.1 0-5.6-2.5-5.6-5.6S8.9 6.2 12 6.2c1.8 0 3 .7 3.7 1.4l2.5-2.4C16.8 3.8 14.6 2.8 12 2.8 6.9 2.8 2.8 6.9 2.8 12S6.9 21.2 12 21.2c5.2 0 8.6-3.6 8.6-8.7 0-.6-.1-1-.2-1.5H12z"
      />
      <path
        fill="#34A853"
        d="M3.9 7.4l3 2.3C7.7 7.8 9.7 6.2 12 6.2c1.8 0 3 .7 3.7 1.4l2.5-2.4C16.8 3.8 14.6 2.8 12 2.8 8.4 2.8 5.3 4.8 3.9 7.4z"
      />
      <path
        fill="#4A90E2"
        d="M12 21.2c2.5 0 4.6-.8 6.1-2.2l-2.9-2.3c-.8.6-1.9 1-3.2 1-3.5 0-6.4-2.3-7.4-5.5l-3 2.3C3.1 18.5 7.1 21.2 12 21.2z"
      />
      <path
        fill="#FBBC05"
        d="M4.6 14.2c-.2-.6-.4-1.3-.4-2.2s.1-1.6.4-2.2l-3-2.3C1.2 9 1 10.5 1 12s.2 3 1 4.5l2.6-2.3z"
      />
    </svg>
  );
}
