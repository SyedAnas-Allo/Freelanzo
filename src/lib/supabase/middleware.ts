import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ROLE_READY_COOKIE } from "@/lib/role-session";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/env";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_complete, active_mode")
    .eq("id", user.id)
    .maybeSingle();

  const onboarded = !!profile?.onboarding_complete;
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
    url.pathname =
      profile?.active_mode === "business" ? "/business" : "/freelancer";
    return NextResponse.redirect(url);
  }

  // Keep home segments aligned with persisted mode so soft nav cannot show
  // a business page under a freelancer shell (or the reverse).
  if (roleReady) {
    const isBusiness = profile?.active_mode === "business";
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
    url.pathname =
      profile?.active_mode === "business" ? "/business" : "/freelancer";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
