# FindIt — Smart Item Finder

**Snap it, stash it, find it in one word.** A React Native + Expo app that solves "where did I put that?" — photograph an item, AI analyses it (objects, colours, description, tags), you note where you kept it, and later a single search word brings the exact photo back.

**Stack:** React Native · Expo · TypeScript · Google Gemini API · AsyncStorage
**Status:** Working prototype v0.13.2 — Free plan 30 items, Pro £2.99/mo (local paywall prototype).

## Highlights
- **Zero-form capture** — photo → automatic Gemini analysis → one question ("Where did you put it?", with a smart place guess) → saved. Saving is never blocked, even offline
- **Ranked search** — understands words, colours, places, even months ("passport october")
- **Bulk gallery import** — multi-select import with duplicate detection, a visible processing queue and per-photo retry
- **Places** — bento-style places, household sharing sheets, QR labels, printable reports
- **Local accounts** — salted-hash prototype auth, photo metadata (taken-at, dimensions), 'Midnight' design system v4

## Run locally
```
npm install
cp .env.example .env    # add your free Gemini key from Google AI Studio
npx expo start          # scan the QR code with Expo Go
```

---

## Version history (development notes)

# FindIt — Smart Item Finder (Prototype v0.9 — Photo Metadata)

v0.9 extracts the useful photo metadata automatically (src/photoMeta.ts):
date/time the photo was TAKEN (EXIF DateTimeOriginal on capture picks,
MediaLibrary creationTime on imports — previously discarded) plus
dimensions. photoTakenAt is distinct from createdAt (stash time):
Detail shows a "Photo taken" fact when they differ, and search now
understands month/year ("passport october"). GPS is deliberately NOT
extracted — it records where the camera was, not where the item is
kept, and is a privacy liability. Metadata unit tests pass.

# FindIt — Smart Item Finder (Prototype v0.8 — Zero-Form Capture)

v0.8 implements zero-form capture (founder-approved direction):
photo → Gemini analysis runs AUTOMATICALLY → the only question is
"Where did you put it?" with a smart place guess (src/placeGuess.ts,
local logic: category history, then most-recent place) pre-selected →
"Stash it". All other fields are hidden behind "Edit details myself".
Saving is NEVER blocked: no key / Gemini busy / offline / failure each
have a calm state, the item saves with an automatic fallback title
and a needsEnrichment flag (shown as "AI details pending" on Detail).
gemini.ts hardened: 25s request timeout (AbortController), typed
GeminiNetworkError thrown immediately (model-hopping can't fix
offline), stale-run guards, camera/gallery failures caught. Edit
mode keeps the full form. Place-guess unit tests pass.

# FindIt — Smart Item Finder (Prototype v0.7 — Sample Data)

v0.7 adds a temporary sample dataset for testing (src/sampleData.ts):
12 items across 5 places, auto-seeded once on first run when the
library is empty, with an in-app banner and one-tap "Clear" (sample
items carry source:'sample'). Photos are stable picsum placeholders;
titles/tags/places are the test data. Reload them anytime from the
empty state ("Load sample data").

# FindIt — Smart Item Finder (Prototype v0.6 — Layout Release, DS v3)

v0.6 keeps the v0.5 Porcelain colours (founder-approved) and rebuilds
the LAYOUT and component organisation from top-app evidence — see
../LAYOUT.md: Spotify-style time-aware masthead + "Jump back in"
tiles, Apple Music Spotlight carousel with dots, bento Places
(size = importance), category rail demoted below content (categories
serve, never gate), search switches the whole layout to single-
column Answer cards, Detail gains a "More from this place" shelf,
and capture adopts the photo+sheet grammar.

# FindIt — Smart Item Finder (Prototype v0.5 — "Porcelain", DS v3)

v0.5 redesigns the UI from published design evidence, not taste — see
../DESIGN_RESEARCH.md for the full study (Mobbin/Refero method;
Apple Photos Liquid Glass, Google Photos + Material 3 Expressive,
Airbnb search/cards). Light porcelain surfaces, violet-indigo seed
accent, floating glass chrome, Airbnb icon category rail, photo-only
cards, sheet-over-photo detail, springy press motion. The v0.4 dark
gallery and v0.2 beige designs were both rejected by the founder.
Same engine underneath (Gemini analysis, ranked search, bulk import,
freemium, Places, colour story).

Take a photo of an item, Gemini notes its properties (title, description,
tags, objects, colours, category, text in the photo), you add where you
kept it — and later you find that exact photo by typing one word, instead
of scrolling through hundreds of photos.

**v0.2 is a full production-grade redesign.** The UX research, flows,
freemium model and complete design system live in `../DESIGN.md`.
Short version: warm paper background, deep-teal brand colour, brass for
Pro, flat solids only — no gradients, no neon, no glow.

## What is new in v0.3 — bulk gallery import (Phase A)
The full UX design is in `../IMPORT_UX.md`. In short:
- **Import** sits next to "Add an item" on Home (and in the empty state)
- A priming screen explains, before any permission prompt, that you
  choose the photos, a resized copy goes to Gemini for analysis, and
  originals are referenced — never copied, so no extra storage
- In-app gallery grid with multi-select; photos already in FindIt are
  labelled and cannot be picked twice; limited photo access is handled
- A pre-flight sheet states exactly what will happen: how many will be
  imported, how many are duplicates, how many need more plan room
- Processing is a visible queue: progress, live counts, cancel; each
  photo is resized to 1024px before analysis; one failure never blocks
  the batch; the summary offers Retry, or tap a failed photo to add
  its tags yourself. Free plan: importing stops at the 30-item limit
  and the rest wait in the summary — upgrade there and import them
- Pro batches are capped at 50 photos at a time for reliability

## What works since v0.2
- **Home** — search-first, category filters, grid/list toggle, ranked
  results, considered empty states, free-plan usage meter
- **Add / Edit item** — photo → "Analyse with AI" (stepped progress,
  automatic retry and model fallback when Gemini is busy) → grouped,
  editable details with a category picker → sticky save bar.
  Editing an existing item works from its detail screen.
- **Detail** — photo, facts card (where kept / category / saved),
  tags, objects, colours, text in photo, edit and delete
- **Freemium** — Free: 30 items, everything searchable, adding is gated
  at the limit (never viewing). Pro paywall sheet with monthly/yearly
  test pricing (£2.99/mo, £23.99/yr, 7-day trial on yearly).
  In this prototype the paywall unlock is local and takes no payment —
  it says so on the sheet. Wire RevenueCat / store billing before launch.
- **Resilience** — if Gemini returns 503 (high demand), the app retries,
  tries the fallback model, then shows a calm warning and lets you save
  with your own tags. Saving is never blocked by the AI.
- Data is stored on the phone (AsyncStorage); photos are copied into
  app storage. No account, no server.

## Run it
1. Install Node.js 20+ if you don't have it.
2. In this folder:
   ```
   npm install
   cp .env.example .env    # then paste your Gemini key into .env
   npx expo start
   ```
3. Install **Expo Go** on your Android/iPhone, scan the QR code.
   Phone and computer on the same Wi-Fi.

Get a free Gemini API key from Google AI Studio
(https://aistudio.google.com/apikey). After editing `.env`, restart Expo —
env files are read at startup.

Model note: the app defaults to **gemini-3.5-flash**. gemini-2.5-flash
returns 404 for new API users (verified 2026-10-13), and if Gemini is
having a demand spike you may see the "AI is busy" message — wait a
minute and analyse again.

## Try the core idea in 1 minute
1. Add a photo of, say, a red screwdriver. Analyse → check the tags →
   location: "Garage — toolbox" → Save.
2. On Home, search `screwdriver`, then `red`, then `garage`.
   The same photo should come up first every time.
3. To see the freemium gate quickly, temporarily set
   `FREE_ITEM_LIMIT = 3` in `src/plan.ts`, add 3 items, then try a 4th.

## Honest limits
- **Key security**: `EXPO_PUBLIC_` values ship inside the app bundle.
  Fine for your own testing; before a public release, move the Gemini
  call behind a small backend that keeps the key on the server.
- Search is weighted keyword search, not semantic embeddings yet —
  embeddings are the planned Pro-era upgrade (see DESIGN.md roadmap).
- Gallery import covers photos you select (Phase A). Full-library
  background scanning, albums and a persisted job queue are Phase B —
  the import screen is designed to grow into it (see IMPORT_UX.md).
- If a gallery original is deleted later, its FindIt record and tags
  remain; the photo area will be empty. Phase B adds an explicit
  "original deleted" message.
- Icons are restrained text glyphs in this build; swap in a proper
  line-icon set (e.g. Lucide) before launch — noted in DESIGN.md.

## Structure
- `App.tsx` — screen switcher + plan state + paywall
- `src/theme.ts` — design tokens (colour, type, space, radius)
- `src/plan.ts` — freemium rules and test pricing
- `src/gemini.ts` — Gemini analysis with 503 retry + fallback model
- `src/storage.ts` — local save/load/update/delete + photo copy
- `src/search.ts` — ranked word search
- `src/components/ui.tsx` — Button, Field, chips, meter, banners
- `src/components/PaywallSheet.tsx`, `src/components/ItemCard.tsx`
- `src/screens/` — Home, AddItem (add + edit), Detail
