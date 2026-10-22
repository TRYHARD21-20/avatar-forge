# Avatar Forge — Photo upload to generated card fix

## What was wrong

The successful single-face validation message was rendered as a red error, while the card preview waited indefinitely for an optional online segmentation model on poor connections. The avatar editor is separate and never auto-creates a photo-based likeness.

## Changes

- A verified upload immediately selects a local portrait, triggers destination-card rendering, and shows the chosen portrait thumbnail.
- The preview displays a status message, then the composited card. Users can click **Generate my postcard preview** to retry explicitly.
- Segmentation has a 3.2-second timeout. If unreachable, a local edge-connected background remover handles plain backgrounds; complex backgrounds use a clearly described softened portrait matte instead.
- Success is shown as a green confirmation, errors separately in red. Photo upload never grants live-angle shards or research eligibility.
- The app provides a separate link to customize the illustrated avatar; it does not claim to infer a person's appearance from a photo.

## Installation

Copy the supplied `apps/web/src/App.tsx`, `apps/web/src/lib/art.ts`, and `apps/web/src/style.css` into the corresponding paths of the same existing project (back it up first). Keep `.git`, APIs, environment settings and all other project files unchanged.

```powershell
npm run build
npm test
git add apps/web/src/App.tsx apps/web/src/lib/art.ts apps/web/src/style.css PHOTO_CARD_FIX.md
git commit -m "Fix photo upload to card preview workflow"
git push origin main
```

Wait for Vercel production Ready, hard refresh /cards, upload the portrait, verify the selected photo and that a destination scene becomes a visible card, and download it. Test again on a slow/offline network. Uploads remain local-only.
