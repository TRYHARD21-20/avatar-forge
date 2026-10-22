# Enable Live Duo and Squad with your existing Vercel site

**Your public frontend stays at:** https://avatar-forge-five.vercel.app

**Why the warning appears:** The original Vercel-only package explicitly returns `rooms:false` from `/api/capabilities`, and `/api/rooms` returns HTTP 503. The UI correctly refuses to create rooms. Merely deleting the warning will not enable multiplayer.

This upgrade changes only the Duo/Squad API and WebSocket routing. Camera processing, consent, game mechanics, photos, face images and scene rendering remain on each player's own device; research uploads remain disabled. Your existing Node/Express/`ws` room server continues to run as a **separate Render service**. This architecture works for an individual hackathon demo on one server instance, although in-memory rooms reset whenever the server restarts. It is **not** production-ready scalable realtime.

## 1. Publish these updated files

Extract this ZIP and copy its project files into your existing VS Code `avatar-forge` repository folder, overwriting the previous version. Keep your `.git/` folder and do not replace GitHub credentials or `.env` secrets. You may also use this ZIP as a fresh copy if you understand Git repositories.

From the project root (contains `package.json` and `vercel.json`) run:

```powershell
npm install
npm run build
npm test
git status
git add .
git commit -m "Connect Duo Squad to external realtime server"
git push origin main
```

The Vercel site will redeploy automatically after a successful GitHub push, but rooms stay disabled until the backend URL is configured.

## 2. Create the room backend on Render

1. Open https://dashboard.render.com and sign in using GitHub.
2. Select **New > Blueprint** and choose your `TRYHARD21-20/avatar-forge` repository. Select the root `render.yaml`. This creates a Node web service with the needed build and start commands. If Blueprints are unavailable, create a **Web Service** from the same repo with root directory blank, build `npm install --no-audit --no-fund && npm run build`, start `npm start`, and health check `/api/health`.
3. Keep `NODE_VERSION=22.16.0`, `DISABLE_RESEARCH_COLLECTION=true`, and create `RECEIPT_SECRET` as a private random string. The Blueprint generates a secret automatically.
4. Set `ALLOWED_ORIGINS=https://avatar-forge-five.vercel.app` (the Blueprint sets this). Add any *additional exact HTTPS frontend origins* only if you use a different site URL.
5. Wait until the backend indicates **Live**. Open its `https://<service>.onrender.com/api/capabilities`; it should show JSON with `"rooms":true` and `"researchContributions":false`.

**Note:** Free Render instances sleep after inactivity. On first Duo/Squad use, wake-up may be slow. Two participants should join the same service. Rooms reset on redeploy/restart; do not use real biometric data for durability testing.

## 3. Connect Vercel to the backend

1. Open your Vercel dashboard > `avatar-forge` > **Settings > Environment Variables**.
2. Add key `VITE_REALTIME_ORIGIN` and value `https://<service>.onrender.com` (replace with your actual Render URL; no final slash).
3. Apply to Production, then go to **Deployments** and **Redeploy** the production deployment. Vite reads this value when building, not at runtime.
4. Open https://avatar-forge-five.vercel.app/duo and hard-refresh (`Ctrl+Shift+R`). If the backend health is reachable and CORS permits the Vercel domain, Create/Join buttons will be enabled.

## 4. Test from two browsers or phones

- Both players grant consent separately and enter a name.
- Player A creates a Duo room and copies the invite link.
- Player B opens the link on another browser/device and joins with the code.
- Both choose Ready; both must see the same question.
- Each player turns their *own* head to lock an answer. A tap fallback marks that selection unverified.
- Try Squad with 4 members and verify votes synchronize.
- Open Developer Tools -> Network -> WS. A working connection should show WebSocket `101 Switching Protocols` to your Render service. If not, check the Render logs and origin allowlist.

## Security and accuracy constraints

- **Don't change** the Vercel `/api/contribute` protection; research uploads must remain disabled without persistent audited storage and reliable deletion.
- The existing server stores rooms in an in-memory Map. It is single-instance and does not survive a restart; it is acceptable only as a clearly described hackathon prototype.
- Long-term production architecture: Redis/pubsub or a managed realtime provider, reconnect/backoff with state resync, persistent consent/audit records and rate limits.
- Squad voting currently has a head-turn selection limited to the displayed two candidates; the accessibility tap can choose any member. Full 4–6-player head-turn carousel needs a further UX update.
- This package is source-checked and capture-logic-tested but **not fully end-to-end tested against a live Render service**. Verify in two real browsers before telling judges it works.
