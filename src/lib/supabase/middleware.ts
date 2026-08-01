import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  ACTIVE_MODE_COOKIE,
  ROLE_READY_COOKIE,
  type SessionMode,
} from "@/lib/role-session";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/env";

function readModeCookie(request: NextRequest): SessionMode | null {
  const value = request.cookies.get(ACTIVE_MODE_COOKIE)?.value;
  return value === "business" || value === "freelancer" ? value : null;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute =
    path.startsWith("/login") ||
    path.startsWith("/auth") ||
    path.startsWith("/onboarding") ||
    path.startsWith("/continue");
  const isPublicAsset =
    path.startsWith("/_next") ||
    path.startsWith("/favicon") ||
    path.includes(".");

  if (isPublicAsset) {
    return supabaseResponse;
  }

  if (!user && !isAuthRoute && path !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (!user) {
    return supabaseResponse;
  }

  const roleReady = request.cookies.get(ROLE_READY_COOKIE)?.value === "1";
  const modeCookie = readModeCookie(request);
  const needsProfileQuery =
    !roleReady ||
    !modeCookie ||
    path === "/login" ||
    path === "/onboarding" ||
    path === "/continue" ||
    path === "/";

  let onboarded = true;
  let activeMode: SessionMode = modeCookie ?? "freelancer";

  if (needsProfileQuery) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_complete, active_mode")
      .eq("id", user.id)
      .maybeSingle();

    onboarded = !!profile?.onboarding_complete;
    activeMode =
      profile?.active_mode === "business" ? "business" : "freelancer";

    // Keep the mode cookie warm when we already paid for the query.
    if (roleReady && modeCookie !== activeMode) {
      supabaseResponse.cookies.set(ACTIVE_MODE_COOKIE, activeMode, {
        path: "/",
        sameSite: "lax",
      });
    }
  }

  const url = request.nextUrl.clone();

  // Fresh login always lands on role gate — profile setup is deferred.
  if (path === "/login") {
    url.pathname = "/continue";
    return NextResponse.redirect(url);
  }

  // Already finished profile setup — don't re-enter the wizard unless returning
  // from an apply/post flow (returnTo is handled client-side after finish).
  if (onboarded && path === "/onboarding" && !request.nextUrl.searchParams.has("returnTo")) {
    url.pathname = "/continue";
    return NextResponse.redirect(url);
  }

  // Role already picked this session — skip the gate.
  if (roleReady && path === "/continue") {
    url.pathname = activeMode === "business" ? "/business" : "/freelancer";
    return NextResponse.redirect(url);
  }

  // Keep home segments aligned with persisted mode so soft nav cannot show
  // a business page under a freelancer shell (or the reverse).
  if (roleReady) {
    const isBusiness = activeMode === "business";
    const onBusiness = path === "/business" || path.startsWith("/business/");
    const onFreelancer =
      path === "/freelancer" || path.startsWith("/freelancer/");

    if (onBusiness && !isBusiness) {
      url.pathname = "/freelancer";
      return NextResponse.redirect(url);
    }
    if (onFreelancer && isBusiness) {
      url.pathname = "/business";
      return NextResponse.redirect(url);
    }
  }

  // Must pick a role after login before using the app.
  if (
    !roleReady &&
    path !== "/continue" &&
    path !== "/onboarding" &&
    !path.startsWith("/auth")
  ) {
    url.pathname = "/continue";
    return NextResponse.redirect(url);
  }

  if (path === "/") {
    url.pathname = activeMode === "business" ? "/business" : "/freelancer";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
