# Freelanzo mobile (Expo WebView shell)

## Google login flow

1. WebView starts Google OAuth (PKCE verifier in `localStorage` — cookies are unreliable when Custom Tabs background the WebView)
2. System browser completes Google → `/auth/callback?native=1`
3. Website opens `freelanzo://auth/session?code=…` once
4. App loads `/auth/native?code=…`, exchanges the code, then mirrors the session into SSR cookies
5. You land on `/continue`

## Supabase Redirect URLs (required)

- Site URL: `https://freelanzo-three.vercel.app`
- Redirect URLs:
  - `https://freelanzo-three.vercel.app/auth/callback`
  - `https://freelanzo-three.vercel.app/**`
  - `freelanzo://**`

## Build

```bash
cd mobile
eas build -p android --profile preview
```

Use the installed APK — not Expo Go.
