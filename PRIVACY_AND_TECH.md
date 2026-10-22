# Technical implementation, consent, limitations and threat model

## Architecture

`React (Vite) → MediaPipe FaceLandmarker → quality estimates → CaptureMachine (local) → IndexedDB AES-GCM → Canvas scene composer → share/export`

`React ⇄ /ws (Express + WebSocket) ⇄ ephemeral 2-player / 4–6-player room state (30-min idle TTL)`

`User opt-in → WebCrypto hybrid encryption (AES-GCM with RSA-OAEP wrapped key) → POST /api/contribute → JSON envelope at server → signed receipt → POST /api/withdraw`.

All calculations in `CaptureMachine` are independent of webcam APIs, enabling fake observations and deterministic unit testing. The yaw thresholds are calibrated degrees derived from MediaPipe face transform matrices, optionally falling back to facial landmarks. This is *orientation estimation*, not identity verification. `sharpness` is an approximation of Laplacian variance computed on a face region, and quality weighting rewards better exposures, stability and face area.

## What is captured

When a player **explicitly accepts device-only camera consent**, then taps **Start Camera**, MediaPipe analyses webcam frames locally; `FrameQuality` samples pixels locally. On a valid target, canvas exports a capped-resolution full frame and portrait crop (re-encoding strips EXIF), plus timestamp, pose and quality. Shots and local card records are AES-GCM encrypted in IndexedDB using a non-extractable device-generated WebCrypto key. No raw camera frame is sent in WebSockets; room messages contain name, readiness, result choice and limited pose activity. It is a **device-key convenience vault**, not password-derived end-to-end encryption, secure key escrow, or authenticated multi-device storage.

**Known limitation:** local non-extractable device keys cannot be transferred. Clearing browsing data loses decryption. Local metadata such as Glow Coins, nickname and consent flags is in localStorage for UI state and is **not encrypted**. Use pseudonymous nicknames; never enter identifiable details in custom poll content. Consent entries are timestamped in encrypted IndexedDB.

## Research consent

Research use is **off unless separately selected** on consent, then the user must *also explicitly press Contribute* in Privacy after live captures. The client derives the payload hash, makes a fresh random AES-256 key, encrypts with AES-GCM, wraps that key with the server RSA-OAEP public key, and sends an envelope. The server persists ciphertext only, plus hash/scope/timestamp/receipt ID and an HMAC signature. A receipt ID can revoke and delete the payload from disk. A server private key is generated locally and persisted as `apps/server/data/private-key.pem`, protected by OS file permissions. Back it up securely if using real research data. Set a strong fixed `RECEIPT_SECRET` for stable receipt signatures; development fallback is ephemeral. Server-side research data has **no automatic deletion schedule yet** and lacks authenticated receipt ownership, so treat the workflow as experimental only.

**Never deploy the current research endpoints publicly.** Withdrawal by UUID alone is not sufficient authentication, and room IDs do not prove an uploaded photo belongs to that person. This is a consent-workflow prototype, not an IRB-approved collection system.

## Platform privacy

- React app has **no first-party analytics, ads, fingerprinting or tracking code**.
- MediaPipe binaries and landmark/segmentation models are fetched from public CDNs on first use. Third-party servers can observe a model resource request, and the MediaPipe SDK's privacy notice discusses diagnostic/usage metrics. No image frames are deliberately uploaded by this code during inference. Network-captured verification is required to assert all telemetry behavior.
- Font stack defaults to local system fonts; SVG art is original hand-authored markup and does not download third-party photos.
- Webcam access is available only on `localhost`/HTTPS secure contexts. Media tracks are stopped when leaving a camera component. Speech synthesis uses browser voices if switched on.
- Room photos are not transmitted at all. Each member's consent/photoConsent flag is tracked; avatar/silhouette fallback remains. Consent must never be treated as transferable to a partner image.
- Self-uploaded images receive dimension, face-count, exposure and blur checking where MediaPipe is available and are always local-art-only, **never contributed**.

## Threat model (implemented vs unmitigated)

| Threat | Mitigation | Residual risk |
| --- | --- | --- |
| Replay/static photo/spoof | Center-first yaw trajectory; holds; quality filters | A recorded video/deepfake can pass. No bank-grade liveness, IR or depth camera |
| Accidentally taking a wrong-angle shot | Per-angle machine, smooth yaw, hysteresis-like EMA, quality gates and exact hold | Camera yaw sign and tuning vary by device; human acceptance testing pending |
| Unauthorized room joining | 10-character crypto-random codes, token HMAC with expiry, Origin and Zod checks, max users, TTL | Invite holders can join; no E2E encryption/auth identity |
| Malicious WebSocket messages | Max 8192 bytes, schema, authorization check, Origin check | Room abuse reporting is non-persistent; no moderation service |
| XSS via names/polls | React escapes all displayed plain text; server length-limits and strips markup; strict API Helmet CSP | No full language-specific abuse moderation; frontend relies on Vite default HTML CSP |
| Oversized malicious upload | MIME/size/dimension check, browser canvas re-encode, server JSON cap | No file-magic-byte inspection beyond decoding; crafted image can exploit browser codec |
| Data leakage / stolen browser | WebCrypto AES-GCM local vault, encrypted remote payload | LocalStorage nickname/settings plain; compromised browser can read unlocked data |
| Consent pressure | All rewards work with contribution OFF; no coin/power advantage; receipt withdraw | User may still misunderstand third-party model downloads |
| Deepfake misuse | Original scenes labeled as generated art; no partner face passed without live consent | No forensic provenance standard; images can still be misused |
| Origin/API compromise | Helmet, CORS, Express rate limits, signed scoped tokens | Not load-tested or externally pentested |

## Legal and ethical scope

Based on purpose limitation, data minimization, transparency, retention, security and withdrawal principles associated with GDPR and India's Digital Personal Data Protection Act 2023. **This is not legal advice or a claim of legal compliance.** Consent obtained through a self-declared 18+ checkbox is not formal age verification. Do not process real participants for a formal dataset until a qualified legal/privacy/security review, consent form, retention schedule, ethics approval and organizational data-controller setup have been completed.

## What is incomplete

- Full 12-language localization (primary navigation and some controls only, all other copy defaults to English; RTL root is supported).
- Model inference Web Worker + OffscreenCanvas worker branch, fully bundled/offline MediaPipe models; current implementation is main-thread with throttled inference, CDN dependencies.
- Complete randomized liveness journey, blink/smile synchronized duo games, WebRTC P2P video, authoritative synchronized time alignment, Squad 4–6-person carousel and combined poster, avatar-derived landmark ratios.
- Premium pack animations/odds, 7-day time capsule, verified referrals, daily quests, server-backed leaderboard, complete store rewards and passcode-derived PBKDF2 key option.
- End-to-end security audit, mobile physical-device and full e2e smoke run.

**Never advertise these omitted features as finished.**
