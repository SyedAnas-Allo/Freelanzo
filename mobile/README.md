# Freelanzo mobile (Expo WebView shell)

## Google sign-in

1. System browser / Custom Tab opens Google
2. Lands on `/auth/callback?native=1` with a short `code`
3. HTML bridge opens `freelanzo://auth/session?code=…`
4. App loads `/auth/callback?code=…` in the WebView and finishes login

If the browser stays open, tap **Open Freelanzo**.

## Supabase (required)

Authentication → URL Configuration:

- **Site URL:** `https://freelanzo-three.vercel.app`
- **Redirect URLs:**
  - `https://freelanzo-three.vercel.app/auth/callback`
  - `https://freelanzo-three.vercel.app/**` (recommended)
  - `freelanzo://**`

## Test

Use the installed APK / `npx expo run:android` — **not Expo Go**.

Website changes must be deployed to Vercel before testing login.
