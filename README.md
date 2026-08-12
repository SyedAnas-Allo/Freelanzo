# Freelanzo

Marketplace for blue-collar / event part-time jobs.

Google sign-in → dual mode → post/discover/apply → hire → OTP attendance → payment confirm/dispute → ratings, job group chat, SOS/Safety, posting fee, reliability, earnings, job history, reviews.

## Stack

- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui
- Supabase (Auth, Postgres, Storage, RLS)
- Expo WebView shell in [`mobile/`](./mobile) (same repo — camera, GPS, Google sign-in)

## Quick start (local)

```bash
# 1. Install
npm install

# 2. Start local Supabase (requires Docker)
npx supabase start

# 3. Env (copy keys from `npx supabase status -o env`)
#    ANON_KEY → NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
#    SERVICE_ROLE_KEY → SUPABASE_SECRET_KEY
cp .env.example .env.local

# 4. Run app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Use **Continue with Google** after enabling Google in Supabase Auth.

### Google OAuth setup

1. Supabase Dashboard → Authentication → Providers → Google
2. Add Client ID / Secret from Google Cloud Console
3. Authentication → URL Configuration → **Redirect URLs** must include local **and** production:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/**`
   - `https://freelanzo-three.vercel.app/auth/callback`
   - `https://freelanzo-three.vercel.app/**`
   - `freelanzo://**` (native app)
4. Keep **Site URL** as production. If localhost isn’t allowlisted, local Google login redirects to Site URL (production) after sign-in.
5. Mobile number is collected during onboarding / Profile — not at sign-in

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js dev server |
| `npm run db:start` | Start local Supabase |
| `npm run db:reset` | Reset DB + re-apply migrations |
| `npm test` | Unit tests |
| `cd mobile && npx expo start` | Native WebView shell (see [`mobile/README.md`](./mobile/README.md)) |

## What's included

- Auth, profiles, dual mode, job post/discover/apply, accept/reject, Call/WhatsApp unlock, proximity filter, notifications
- OTP check-in/out (+ camera photo + GPS), payment confirm/dispute matrix, mutual ratings
- Job group chat (accepted workers + business, realtime), SOS/Safety, posting fee (first 2 free), reliability gauge, earnings, job history, reviews

## Out of scope (later)

Razorpay, SMS/push reminders, admin dashboard, document verification, primary/backup staffing schema.
# Freelanzo
