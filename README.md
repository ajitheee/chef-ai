# Digital Chef AI — Production Scaler

Scales a standardized dining-hall recipe to today's cover count and returns a
production sheet: scaled recipe (with effective multipliers + reasons), batching
plan, hot-line holding notes, and an as-purchased pull list.

**Works out of the box with no API key (demo mode):** the full flow — scale →
sheet → refine → print/CSV/copy → history — runs end-to-end on a pre-authored
sample sheet, clearly labeled. Add `ANTHROPIC_API_KEY` and the same buttons
switch to the live engine automatically.

## Features
- One-screen scaling: recipe + tonight's covers → full production sheet
- Variations / options: from a dish or his recipe, propose 2-3 distinct versions
  (base swap, lower-sodium, holds-better) — pick one, then scale it
- Multi-turn refinement: "drop to 400 covers", "make it vegetarian", "less spicy"
  — edits transform the active sheet (one object, one brain)
- Save & reuse recipes (no re-typing) + recent-sheet history
- Photo of a recipe card as input (vision)
- Print / PDF, CSV pull-list export, copy-to-clipboard
- Tablet/phone friendly for use on the line

## Stack
- Next.js (App Router) + TypeScript + Tailwind
- Anthropic Claude API (the engine, isolated in `lib/engine/`)
- Zod for validation

## Run it
1. `npm install`
2. `npm run dev` → open http://localhost:3000 (runs in demo mode immediately)
3. Click **Load sample** → **Scale recipe** to see a full production sheet.
4. To go live: copy `.env.local.example` to `.env.local` and add your
   `ANTHROPIC_API_KEY` (https://console.anthropic.com — a few dollars of credit
   is plenty), then restart the dev server.

## Structure
```
app/
  page.tsx             one screen: input + production sheet + refine + history
  api/scale/route.ts   POST -> scale (live engine, or demo sheet without a key)
  api/refine/route.ts  POST -> transform the active sheet per instruction
lib/engine/            THE BRAIN (no UI knowledge)
  prompt.ts            v3.3 dining-hall system prompt + refine prompt
  schema.ts            structured production sheet (Zod + JSON schema)
  claude.ts            Anthropic calls (forced structured output)
  demo.ts              demo mode: pre-authored sample sheet, no key required
  sample.ts            sample recipe for testing
lib/
  storage.ts           saved recipes + sheet history (localStorage)
  export.ts            CSV / text views of the production object
```

## Principles
One object (the production sheet) · one brain (the engine) · many lenses
(print, CSV, copy, refine, history are all views/transforms of the same object).
