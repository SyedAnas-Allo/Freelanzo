import { NextResponse } from "next/server";
import { ROLE_READY_COOKIE } from "@/lib/role-session";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/continue";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(`${origin}${next}`);
      // Force role pick on every fresh login.
      response.cookies.set(ROLE_READY_COOKIE, "", { path: "/", maxAge: 0 });
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
