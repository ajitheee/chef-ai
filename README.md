# Digital Chef AI — Production Scaler (Week 1 build)

Scales a standardized dining-hall recipe to today's cover count and returns a
production sheet: scaled recipe (with effective multipliers + reasons), batching
plan, hot-line holding notes, and an as-purchased pull list.

## Stack
- Next.js (App Router) + TypeScript + Tailwind
- Anthropic Claude API (the engine, isolated in `lib/engine/`)
- Zod for validation

## Run it
1. `npm install`
2. Copy `.env.local.example` to `.env.local` and add your `ANTHROPIC_API_KEY`
   (get one at https://console.anthropic.com — a few dollars of credit is plenty).
3. `npm run dev` → open http://localhost:3000
4. Click **Load sample (Jambalaya)** → **Scale recipe**.

## Structure
```
app/
  page.tsx            one screen: input + production sheet
  api/scale/route.ts  POST -> runs the engine
lib/engine/           THE BRAIN (no UI knowledge)
  prompt.ts           v3.3 dining-hall system prompt
  schema.ts           structured output (Zod + JSON schema)
  claude.ts           Anthropic call (prompt caching, forced structured output)
  sample.ts           sample recipe for testing
```

## Status
Week 1 of the 3-week plan — one workflow (daily dining-hall production scaling).
No login / billing / image input yet (those are Week 2–3).
