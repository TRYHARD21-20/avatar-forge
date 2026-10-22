# Avatar Forge original app — Supabase Login/Register upgrade

This patch targets **TRYHARD21-20/avatar-forge**, deployed at https://avatar-forge-five.vercel.app.
It does **not** target `avatar-forge-v3` or the separate V3 Render site.

## Why Supabase Auth?
Persisted email/password identities managed by Supabase Auth; no home-made password database, no user credentials stored in the repo. Registration, login, verification email, password reset and logout are implemented.

## One-time setup
1. Create a Supabase project at https://supabase.com/dashboard (or use one under your own account).
2. Go to **Authentication → Providers → Email**, enable email/password and keep email confirmation enabled.
3. In **Authentication → URL Configuration**, set Site URL to `https://avatar-forge-five.vercel.app`, and add redirect URLs `https://avatar-forge-five.vercel.app/login`, `https://avatar-forge-five.vercel.app/reset-password`, `http://localhost:5173/login`, `http://localhost:5173/reset-password`.
4. Copy **Project URL** and **publishable key** (legacy anon key is also supported) from Project Settings / API Keys. NEVER expose service_role/secret key in a VITE_ variable.
5. Vercel: `avatar-forge` → Settings → Environment Variables, add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Scope Production (and Preview if needed). Redeploy **latest main commit**. Preserve your existing `VITE_REALTIME_ORIGIN`.
6. Local: put the two same variables into the repo-root `.env` *and* `apps/web/.env.local` if running Vite from the web workspace; use `npm install`, `npm run build`, and `npm test`. The local env file must never be committed.
7. Visit `/register` → verify email → `/login` → `/consent` → gameplay; then log out and log in again, and test `/reset-password`.

## Data, limitations and privacy
* Supabase gets email/password credentials managed by Supabase Auth. Face images are never intentionally sent to Supabase by this patch.
* The web app's device-local game state, private captures and Daily Quests are **namespaced by Supabase user ID**, so multiple browser users do not accidentally inherit each other's local cards. Previously created guest-only data remains on the device but is not imported or deleted automatically.
* This is **frontend login gating**, not server-side authorization of the existing Render `/api/rooms` API or `/ws` connections. WebSocket room codes remain the existing access control. Do not call it secure account-based multiplayer authorization.
* Authentication sessions are persisted by the Supabase browser client. Use only test accounts with strong unique passwords; avoid storing sensitive face data on shared devices.
* Email delivery is subject to Supabase rate limits. For a judge demo, pre-create and verify a demo user; never disable email confirmation just to skip verification.
* Project owners must configure privacy policies, data retention/deletion for Supabase account data, and any needed DPDP/GDPR obligations. Clearing local data does not delete the account stored by Supabase.
* If Supabase credentials are missing, the **existing guest gameplay remains available** so an accidental early deployment does not break the demo. The Login screen clearly shows a configuration message; guest mode must never be represented as authenticated. Once both variables are configured and Vercel redeploys, login becomes required for game routes.

## Installation
Apply only the listed files in this ZIP into your EXISTING original `avatar-forge` project, preserving `.git`.
Use the included `APPLY_ORIGINAL_AUTH.ps1`, or copy the files manually, then:

```powershell
cd "C:\Users\Admin\OneDrive\Desktop\avatar-forge"
npm install
npm run build
npm test
git status
git add .env.example apps/web/package.json apps/web/src/App.tsx apps/web/src/main.tsx apps/web/src/style.css apps/web/src/lib/auth.tsx apps/web/src/lib/store.ts apps/web/src/lib/storage.ts apps/web/src/lib/quests.js LOGIN_SETUP.md
git commit -m "Add persistent login and registration to original Avatar Forge"
git push origin main
```

On Vercel, check the newest production commit is live. Log in and test Duo/Squad, capture and cards again. Do not overwrite the old V3 repo.
