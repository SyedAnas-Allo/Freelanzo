import { NextResponse } from "next/server";
import { ROLE_READY_COOKIE } from "@/lib/role-session";
import { createClient } from "@/lib/supabase/server";

const APP_SCHEME = "freelanzo";
const APP_PACKAGE = "co.id.freelanzo.app";
const APP_RETURN = "freelanzo://auth/session";

/**
 * One deep-link open only. Prefer freelanzo:// (AuthSession listens for it);
 * Intent URL is the visible button fallback.
 */
export function nativeReturnHtml(appUrl: string): string {
  const intentPath = appUrl.replace(/^freelanzo:\/\//i, "");
  const intentUrl = `intent://${intentPath}#Intent;scheme=${APP_SCHEME};package=${APP_PACKAGE};end`;
  const safeApp = JSON.stringify(appUrl);
  const safeHref = intentUrl
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
  const safeFallback = appUrl
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Returning to Freelanzo</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; min-height: 100dvh;
      align-items: center; justify-content: center; margin: 0; background: #F8F2FF;
      color: #1a1a1a; text-align: center; padding: 24px; box-sizing: border-box; }
    a.btn { display: inline-block; margin-top: 20px; padding: 16px 28px; border-radius: 12px;
      background: #8E30FF; color: #fff; font-weight: 700; text-decoration: none; font-size: 16px; }
    p { margin: 0; line-height: 1.4; }
    .muted { margin-top: 10px; opacity: 0.7; font-size: 14px; }
  </style>
</head>
<body>
  <div>
    <p><strong>Sign-in complete</strong></p>
    <p class="muted">Opening Freelanzo…</p>
    <a class="btn" id="open" href="${safeHref}">Open Freelanzo</a>
    <p class="muted" style="margin-top:16px"><a href="${safeFallback}">Backup link</a></p>
  </div>
  <script>
    (function () {
      var done = false;
      function openApp() {
        if (done) return;
        done = true;
        window.location.href = ${safeApp};
      }
      openApp();
    })();
  </script>
</body>
</html>`;
}

function isNativeRequest(
  searchParams: URLSearchParams,
  forceNative: boolean,
): boolean {
  if (forceNative) return true;
  return searchParams.get("native") === "1";
}

export async function finishNativeOAuth(
  request: Request,
  options?: { forceNative?: boolean },
): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/continue";
  const native = isNativeRequest(searchParams, options?.forceNative === true);

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  // Native Custom Tab: do not exchange (no PKCE cookies here). Bridge code only.
  if (native) {
    const appUrl = `${APP_RETURN}?code=${encodeURIComponent(code)}`;
    return new NextResponse(nativeReturnHtml(appUrl), {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  // Desktop / WebView callback: exchange on the server.
  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (!error) {
    const response = NextResponse.redirect(`${origin}${next}`);
    response.cookies.set(ROLE_READY_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  }

  return NextResponse.redirect(`${origin}/login`);
}
