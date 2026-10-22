# Avatar Forge — Publish to GitHub and host your full game

## Before publishing

1. Open the extracted `avatar-forge` folder, the one that contains the **root** `package.json`.
2. Prefer Node **22.16.0** (`node -v`).
3. Stop old servers, then run `npm install`, `npm ls framer-motion motion-dom motion-utils`, `npm run build`, and `npm test`.
4. Use `npm run dev` to smoke-test `http://localhost:5173`, `/dev`, `/cards`, `/consent` and two separate browsers in `/duo`.
5. If the build fails, **do not deploy yet**: paste its actual error into your development chat to repair it.

## Publish GitHub repository

- Go to https://github.com/new, create a repository named `avatar-forge` (private while testing; public if judges need access). Do not initialize it with a README.
- From the folder with root `package.json`, run:

```bash
git init
git add .
git commit -m "Avatar Forge hackathon demo"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/avatar-forge.git
git push -u origin main
```

Replace `YOUR_USERNAME`; authenticate with GitHub in the browser or credential manager when prompted. `.gitignore` excludes `node_modules`, `.env`, research receipts and server data.

## Host **both** the web app and WebSocket server on Render

A static-only Vite/Vercel frontend will **not** provide `/api` or `/ws`. This project is prepared for **one Render web service** that serves the built React frontend, REST API and real-time rooms over one secure origin.

1. Visit https://dashboard.render.com and choose **New → Blueprint** (using your GitHub repository and its root `render.yaml`). Alternatively choose **New → Web Service** and connect the GitHub repository.
2. For manual Web Service creation, use **Root Directory blank**, **Node**, **Build Command** `npm install --no-audit --no-fund && npm run build`, and **Start Command** `npm start`.
3. Set **NODE_VERSION** to `22.16.0` and add a randomly generated **RECEIPT_SECRET** in the environment settings (Blueprint generates it automatically). Do not put the secret in GitHub.
4. Configure health check at `/api/health`. Choose a service plan with sufficient resources.
5. Wait for the deploy to report Live, then open the actual Render URL shown in your dashboard. **Do not invent or submit a URL before it is live.**
6. Verify the homepage, consent gate, `/dev`, scene-card exports, Solo, and Duo via two devices. Use HTTPS; camera permission requires a secure context.
7. The server reads Render's `RENDER_EXTERNAL_URL` so same-origin WebSocket connections work in the hosted app. If using a custom domain, add its exact HTTPS origin to `ALLOWED_ORIGINS` (comma-separated list).

### Why research upload is OFF on public hosting

The hackathon implementation saves encrypted research files and consent receipts to local disk. Render's default storage is **ephemeral**, so withdrawal and long-term retention cannot be guaranteed after redeploys. Production mode therefore **disables research contributions** while still allowing all play, scene rewards and local exports. Do not change this without implementing persistent, audited storage and access controls. The demo also uses memory-only rooms that reset on restart.

### Hosting checklist

- Build finishes successfully; `/api/health` returns JSON with `ok: true`.
- User can navigate refreshable SPA URLs such as `/consent`, `/solo`, `/duo`.
- `/api/capabilities` reports `researchContributions:false` on Render.
- Room participants can join via an **https** invite URL and WebSocket uses **wss**.
- Browser camera access works only after local consent.
- Test on Chrome/Edge and a mobile phone before you film.

## Final three links for SHAIP

- **Google Drive:** a folder containing source ZIP, project-working report PDF and walkthrough video; share Editor access specifically with `vedant.j@shaip.com`.
- **GitHub:** the URL of your actual `YOUR_USERNAME/avatar-forge` repository.
- **Hosted URL:** the actual `https://...onrender.com` URL after Render reports a successful deployment and you verify it.

Never place the real README/report-only preview URL in the Hosted URL field. Demo is a prototype: not a production biometric dataset collection product.
