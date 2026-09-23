# Kitchen Brain — governing documents

The engine's brain is two documents owned by the chef, stored here **verbatim** and versioned:

| Document | Role in the app | Current |
|---|---|---|
| Universal Kitchen Brain **Master Prompt** | The system instructions: how the engine reasons, scales, validates and writes. Sent verbatim on every call, followed by the app's *application contract* (`lib/engine/brain/contract.ts`), which maps the prompt's recipe contract onto the structured production sheet and states the organization overlay (US dining hall, US customary units). | v3.0 |
| Universal Culinary Production **Knowledge Pack** | The searchable knowledge source. Split into one entry per section; each scale request retrieves only the sections that match the recipe (`lib/engine/brain/retrieve.ts`) plus a small always-on core (yield equations, AP/EP, units, rounding, validation). The sheet records which sections were applied. | v3.0 |

`current.json` names the active version of each. Older versions stay in this folder for history.

## Updating to a new version

1. Drop the new `.docx` files in this folder.
2. Extract them verbatim to markdown:
   `python scripts/docx_to_md.py docs/kitchen-brain/<file>.docx docs/kitchen-brain/master-prompt.v3.1.md`
   (same for the knowledge pack).
3. Point `current.json` at the new files.
4. Generate the TypeScript modules the engine imports: `npm run brain`
   (writes `lib/engine/brain/master-prompt.ts` and `lib/engine/brain/knowledge-pack.ts` — generated, never hand-edited).
5. If the pack gained a section, add its retrieval triggers in `lib/engine/brain/retrieve.ts` (a section without triggers is retrieved only when its title words appear in the recipe).
6. `npm run sweep && npm run referee`, scale two real cards on the live engine, then deploy.

The version in the document's own header table (`| Version | 3.0 |`) is what the app reports in `/api/health` and stamps on every sheet.
