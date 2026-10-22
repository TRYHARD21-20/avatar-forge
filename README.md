# Vercel deployment edition

This version targets a **Vercel-hosted judging demo**. See [VERCEL_DEPLOY.md](VERCEL_DEPLOY.md) for precise GitHub and Vercel settings. Public Vercel hosting currently supports Solo, scene cards and local capture; online Duo/Squad rooms need a distributed realtime backend. The original `apps/server` code remains available for local testing. Public research uploads are explicitly disabled.

---

# AVATAR FORGE 📸

**A retro-futurist photo-booth game with consent-first facial pose challenges and travel-poster artwork.** This is a runnable hackathon **prototype**, not a production biometric dataset pipeline. Honest completion matrix below.

## Fastest way to **see something**

This ZIP includes two clearly separate entry points:

- **`OPEN_PREVIEW.html`** — double-click it after unzipping to view an interactive offline **design preview** with scene art and simulated head-turn choices. This has **no camera**, **no backend**, **no face data**, and is not the actual React app.
- **`START_AVATAR_FORGE.bat`** (Windows) — checks the Motion dependency compatibility, runs npm install to repair mismatches or install missing modules, starts the real Vite frontend plus Express backend, and opens localhost once it responds. Requires Node.js 22 and internet on first launch.

**Do not double-click `apps/web/index.html`.** It is an app entry point requiring Vite, not a standalone HTML file. The full app runs at `http://localhost:5173` after `npm install` and `npm run dev`.

See `QUICK_START.txt` for the minimal steps and what to do if you see a blank screen.

## GitHub + live submission deployment

See **`GITHUB_AND_HOSTING_GUIDE.md`** for verified commands to publish the monorepo and deploy the React app **together with** its Express/WebSocket server on Render. Public production hosting disables research image uploads by design, because the prototype does not have a persistent audited storage layer. Running the app locally (`npm run dev`) is unchanged.

## Launch in Visual Studio Code (Windows, macOS, Linux)

**Node.js 22.16.0** recommended (see `.nvmrc`); Node 24 is outside the supported engine range, though the Motion dependency mismatch in the reported log is a separate issue. VS Code terminal:

```bash
npm install
npm run dev
```

Open **http://localhost:5173**. The web client uses port **5173** and the local Express + WebSocket API uses port **3001**. `npm run dev` runs both with `concurrently`. Need full internet access for `npm install` and, on the first face-model use, for the MediaPipe model/CDN. Subsequent model loading may be cached by the PWA, but **offline inference is not guaranteed**.

**No API key or paid service is needed.** On Windows, camera is available at `localhost` in Chrome/Edge; if using a remote URL, serve over HTTPS. Accept browser camera permission only after completing the consent screen. You can use `/dev` to demo camera logic without a camera; synthetic demo never generates research-eligible face captures.

### Scripts

```bash
npm run dev          # Vite + API concurrently
npm run build        # TS typecheck + production Vite bundle
npm test             # Vitest + dependency-free Node test suite
npm run test:logic   # dependency-free Node tests only
npm run lint         # ESLint
npm run typecheck    # TypeScript strict-mode check
npm run test:e2e     # Playwright smoke (needs Chromium: npx playwright install chromium)
```

## What happens in the actual game

- `/consent`: adult self-declaration and separate device-only/research/group-photo permissions. Research opt-in grants **no game advantage**.
- `/capture`: front, left, right angle challenges. `CaptureMachine` (in `packages/shared/src/capture.js`) requires valid image quality, center-first calibration, real signed yaw, a smoothly sampled turn, and a 700–1050ms side hold. Rolling the head or waiting in front will never count. Turn selection has a 1-second hold. **Real-world yaw direction may require flipping using the calibration button**, depending on camera orientation.
- `/solo`: five genuine turn-to-choose questions; entertaining deterministic results, explicitly not a scientific/biometric personality predictor.
- `/duo`: secure invite codes, 2-player readiness, WebSocket answer locking, live split-style activity, shared reveals and actual answer-based score. Each member must be on a separate browser/device. The accessibility fallback allows tapping but never qualifies that action as a biometric capture.
- `/squad`: 4–6-member consent-and-ready gate, leader-managed topic, live votes, winner reveal, and a 2-candidate head-turn pair plus an inclusive manual roster fallback. This **does not yet implement the specified full carousel or group panorama**.
- `/cards`: fourteen independently drawn SVG destination scenes (Paris, Tokyo, Santorini, Alps, Maldives, Jaipur, Kerala, Dubai, New York, Mumbai, space, forest, cherry blossoms and dunes). Client-side Canvas composes the player's portrait into the scene. MediaPipe segmentation is attempted; a visibly less accurate oval-matte fallback is used if the segmentation model cannot load. Exact pixel exports (1080×1080, 1080×1350, 1080×1920, 1600×900, 1200×627, 1200×630, 640×640) and download/share controls.
- `/forge`: user-customizable illustrated face avatar (skin/hair/outfit/accessory colors are **user-selected**, not inferred); SVG export.
- `/store`, `/passport`, `/leaderboard`: Glow Coins, stamp collection, local souvenirs, local score and angle shards. The leaderboard is **local**, not an invented global ranking.
- `/privacy`: encrypted local vault export/delete, consent updates, explicit separately encrypted research submission with server-signed receipt ID and remote withdrawal. **Always save receipt ID before clearing local data.**
- `/dev`: deterministic timed pose simulator for camera-free judges. Slide yaw from 0° toward the target and hold; no real images are taken.

## Test matrix

| Requirement | Status | Evidence / limitation |
| --- | --- | --- |
| Stationary front never creates left/right shots | **Done (logic)** | `packages/shared/tests/capture.test.mjs`; 16/16 passed in authoring environment |
| Side shots require correct yaw & continuous turn | **Done (logic)** | Center-first, EMA, hold, quality gating; sensor-level device testing needed |
| Roll-only and static side photos rejected | **Done (logic)** | Tests for rotation, static side, resets |
| Duo turn-only answers and 2-player rooms | **Implemented; unverified end-to-end** | `FaceStage`, `/ws`, `RoomGame`; WebSocket on localhost |
| Quality gates | **Implemented; calibration needed** | Face count/area/exposure/blur/pose/velocity/eyes; Laplacian filter |
| Consent blocks camera | **Done (logic/UI)** | Guard route and Start Camera button gated |
| Every Squad member opts in | **Done (room membership)** | `consent:true`, readiness gate, optional photo scope tracked |
| Rich composited scenes, not hue filters | **Done (artwork), Partial (matte)** | Fourteen original SVG scenes; segmentation model or elliptical fallback |
| Resolution-correct exports | **Done (implementation)** | Canvas assigned preset width/height before `toDataURL()`; browser validation pending |
| Language switch & RTL | **Partial** | 12 languages registered; primary strings translated, many game/consent strings remain English |
| 3 angle shards, coins, avatar, local store and stamps | **Partial** | Working basic mechanics; no packs, streak calendar, sealed capsule or booth printing |
| WebRTC remote video, sync meter, Squad panorama | **Not implemented** | Avatar/silhouette status via room data only; no video transmitted |
| Random blink/smile liveness sequence | **Partial** | Capture machine supports blink/smile and randomized challenge utility; not wired into all game journeys |
| AES-GCM at rest / client encrypted research upload | **Done (implementation)** | WebCrypto encrypted IndexedDB & RSA-wrapped submission; no external audit |
| Full offline face inference | **Not implemented** | CDN model is lazy-loaded; PWA app shell exists; model may need internet |
| E2E camera, 2 devices and mobile accessibility | **Not verified** | Playwright smoke file included but dependencies unavailable in authoring runtime |

### Verification from this environment

- `node --test packages/shared/tests/*.test.mjs`: **16 passed / 0 failed**.
- `node --check apps/server/src/index.mjs`: **passed**.
- TypeScript JSX **syntax parsing** with the globally available TS transpiler: **passed**, but **not** a dependency-aware typecheck.
- `npm install`: **not completed** because this authoring container could not resolve `registry.npmjs.org` (no network DNS), so `npm run build`, `npm test` (Vitest half) and `npm run test:e2e` **could not be run here**. The ZIP must be installed and checked locally; this is **not claimed as build verified**.

## Dependency repair (fixed 2026-10-22)

A Vite/esbuild startup error `No matching export ... activeAnimations` occurred because `framer-motion@12.23.3` uses an internal import removed from newer `motion-dom` releases. The project **now pins** `motion-dom@12.23.2` and `motion-utils@12.23.2` using root npm `overrides`. These versions satisfy `framer-motion@12.23.3`'s declared dependency constraints and preserve the existing transitions. On Windows, after extracting this fixed ZIP:

```powershell
npm install
npm ls framer-motion motion-dom motion-utils
npm run dev
```

Or double-click `START_AVATAR_FORGE.bat`, which checks and repairs the pinned versions before launching. If npm continues to read an older lockfile, delete `package-lock.json` once and run `npm install` again. **Do not delete source folders.**

Expected versions: `framer-motion@12.23.3`, `motion-dom@12.23.2`, `motion-utils@12.23.2`. This changes only dependency resolution and launcher documentation, not game behavior. The full browser build still requires local npm install.

## Troubleshooting

- **`npm` not recognized:** install Node 22 LTS / Node 22.16.0 and restart VS Code.
- **npm install fails:** check internet/DNS, VPN/firewall, and `npm config get registry` (`https://registry.npmjs.org/`).
- **Camera unavailable:** use Chrome or Edge on `localhost` (or HTTPS) and allow permission in browser settings; close other video apps. Use `/dev` for synthetic demonstration.
- **Face detector loading:** first run requires access to jsDelivr and Google MediaPipe model hosting. Check browser Network tab; the consent-only routes still work without a model.
- **Wrong left/right direction:** click the **flip** button by the camera controls. Direction conventions depend on webcam coordinate mirroring.
- **Blurry/too dark message:** face camera in brighter soft light; make face larger and keep still. Easy Mode reduces yaw requirement to 18° but does not bypass quality checks.
- **Room not connecting:** keep the local server on port 3001 and make sure both devices use the same reachable host. For phones, use HTTPS and configure CORS and WebSocket origins.
- **Camera stops after selection:** intentional: component unmount ends tracks to reduce privacy risk.
- **Research withdrawal:** paste your receipt UUID in Privacy > Withdraw; local deletion does not automatically delete data you separately contributed.

## Repo tree

```text
apps/web/           Vite + React 18 + Tailwind + PWA + canvas artwork
apps/server/        Express / ws, room TTL, consent receipts, encrypted contributions
packages/shared/    Schemas, capture engine, scoring, original scenes and tests
tests/              Playwright smoke specs
DEMO_SCRIPT.md      2-minute video guide and 60-second pitch
PRIVACY_AND_TECH.md Privacy, deployment and threat model
```

**Scope:** hackathon only. Do not deploy as a real biometric research product without security, legal, safeguarding, access-control and data-retention reviews. The camera app is browser-based; models run on the user's device but model downloads and possible MediaPipe telemetry require a transparency review.
