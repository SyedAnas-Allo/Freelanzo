# Freelanzo mobile (Expo WebView shell)

Thin native wrapper around the Freelanzo website. Same repo as the Next.js app — no separate project required.

Uses **Expo SDK 54** so it works with the Expo Go app currently on the Play Store / App Store.

## What it does

- Loads `EXPO_PUBLIC_WEB_URL` (default `https://freelanzo-three.vercel.app`) in a WebView
- Enables WebView camera / geolocation; the OS asks only when the site uses them (attendance, nearby jobs, uploads)
- Opens **Google OAuth in the system browser** (Google blocks embedded WebViews), then returns the session into the WebView via deep link

## Run

```bash
cd mobile
cp .env.example .env   # optional: point at local Next.js
npm install
npx expo start
```

Then press `i` (simulator) / `a` (emulator), or scan the QR with Expo Go.

**Camera + GPS inside the WebView are most reliable in a development build**, not Expo Go:

```bash
npx expo run:ios
# or
npx expo run:android
```

### Local website

```bash
# terminal 1 — from repo root
npm run dev

# terminal 2 — mobile/.env
EXPO_PUBLIC_WEB_URL=http://localhost:3000   # iOS sim
# EXPO_PUBLIC_WEB_URL=http://10.0.2.2:3000  # Android emulator
# EXPO_PUBLIC_WEB_URL=http://192.168.x.x:3000  # physical device
```

## Google sign-in setup (required once)

1. Supabase Dashboard → **Authentication → URL configuration**
2. Set **Site URL** to `https://freelanzo-three.vercel.app` (not localhost)
3. Under **Redirect URLs**, add:
   - `https://freelanzo-three.vercel.app/auth/callback`
   - `http://localhost:3000/auth/callback` (only if you still test the website locally)
4. Keep Google provider enabled as before

The native shell always requests the Vercel `/auth/callback` redirect and rewrites any accidental `localhost/?code=…` return onto that URL.

## Permissions

Asked by the OS on first use (not at launch). Copy lives in `app.json` (`ios.infoPlist` + config plugins):

| Permission | Why |
|---|---|
| Camera | Check-in / check-out attendance photos |
| Location | Attendance verification + nearby jobs |
| Photos | Profile and work photo uploads |

## Not publishing yet

This shell is wired for local / internal testing. Store listing, push notifications, and App Links / Universal Links can come later.
