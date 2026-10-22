# Avatar Forge — Deploy to Vercel

**Deployment target:** Single Vercel website for the React/Vite front end, local games, simulated capture lab and scene-card exports. A deployed API health/capabilities function reports the supported features. Research contribution upload is OFF by design.

## What the Vercel demo actually supports

- **Works without the Node room server:** Consent, local storage, Solo, head-turn capture (on supported cameras/browsers), visual cards, avatar, rewards, `/dev`, and offline sample mode.
- **Not yet supported in the Vercel URL:** Real-time multi-device Duo and Squad rooms. The existing `apps/server/` Node+`ws` implementation is preserved for local testing. Distributed Vercel deployments need durable shared room state, WebSocket session handling/reconnection and a storage service such as Redis. Do not claim these modes are deployed yet.
- **Never deployed as a contribution collector:** `/api/contribute` returns HTTP 403, `/api/capabilities` reports `researchContributions:false`. This prevents unreliable storage/withdrawal on ephemeral compute.
- The `OPEN_PREVIEW.html` file is a separate design sample. Submit the actual Vercel web app URL, not the preview file.

## Step 1 — Test on Windows before uploading

Use Node **22.x** (project `.nvmrc`). Extract into a folder containing `avatar-forge/package.json`.

```powershell
cd "C:\path\to\avatar-forge"
npm install
npm ls framer-motion motion-dom motion-utils
npm run build
npm test
npm run dev
```

The repository pins `motion-dom` and `motion-utils` at `12.23.2` to avoid the earlier `activeAnimations` export mismatch. If installation was previously interrupted, remove the project-root `node_modules` and `package-lock.json`, then reinstall, but only if necessary.

## Step 2 — Publish to GitHub

1. Create a repository at https://github.com/new, such as `avatar-forge`.
2. In the folder **that contains** `vercel.json` and the root `package.json`, run:

```bash
git init
git add .
git commit -m "Prepare Avatar Forge Vercel judging demo"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/avatar-forge.git
git push -u origin main
```

Do not upload `node_modules`, `.env`, or server data. `git add .` follows the `.gitignore`. Replace `YOUR_USERNAME` with your own account name. The full monorepo, including `packages/shared`, must be in the repository.

## Step 3 — Import to Vercel

1. Visit https://vercel.com/new and **Import Git Repository** → your `avatar-forge` repository.
2. Choose **Vite** for Framework Preset.
3. Set **Root Directory: `./` (repository root)**, NOT `apps/web`, because this project has npm workspaces and `vercel.json` at the repository root.
4. Let the included `vercel.json` specify **Build Command: `npm run build`**, **Install Command: `npm install --no-audit --no-fund`**, **Output Directory: `apps/web/dist`**.
5. Set Node.js to **22.x** in Vercel Project Settings if it has chosen a different version.
6. Click **Deploy**. Copy the actual assigned `https://…vercel.app` link only after the deployment succeeds.

The included rewrite sends client-side routes such as `/consent`, `/cards`, `/solo` and `/dev` to `index.html` on refresh. API Functions take precedence over the SPA fallback.

## Step 4 — Smoke test the real Vercel site

- `/` — homepage renders, no browser console errors.
- `/api/health` — JSON `ok:true`.
- `/api/capabilities` — JSON `rooms:false` and `researchContributions:false`.
- `/consent` — self-declaration and device-only permission before camera.
- `/dev` — gradual yaw moves target; static face must never qualify as side capture.
- `/capture` — actual camera requires HTTPS and user gesture; test with user consent.
- `/solo` — turning head can select an option, or accessibility tap fallback.
- `/cards` — choose among 14 illustrated scene backgrounds and export exact-size output.
- `/duo`, `/squad` — explicit notice that public multiplayer rooms are unavailable; no false success response.
- In browser DevTools → Console check whether any `activeAnimations` dependency error remains. Revisit `npm ls ...` if it does.

## For full realtime Duo and Squad on Vercel later

As of June 2026, Vercel Functions have native WebSocket support with Fluid Compute, but connections can land on separate instances and are bounded by Function execution duration. To preserve multiplayer correctness, migrate rooms to a shared store (typically Redis), implement cross-instance fan-out, WebSocket reconnection, origin/token verification, and persistent consent metadata. Simply uploading the old `node --watch` Express server or copying in-memory `Map` into a function will not provide reliable production rooms.

See:
- https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections
- https://vercel.com/kb/guide/real-time-chat-websockets
- https://vercel.com/docs/frameworks/frontend/vite

## SHAIP submission

- Google Drive folder: source ZIP, project-working report PDF, final walkthrough recording. Share **Editor** with `vedant.j@shaip.com`.
- GitHub URL: your actual published repository URL.
- Hosted URL: your actual successful Vercel deployment URL. Be transparent that Duo/Squad require backend integration, rather than presenting them as finished online.

**Caution:** The file is prepared for Vercel, not deploy-verified. This environment could not reach the npm registry to run a full frontend build. Verify locally or from the Vercel build logs before submitting.
