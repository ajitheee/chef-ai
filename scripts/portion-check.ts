/**
 * Portion check: the deterministic finished-yield figures (lib/engine/portion.ts)
 * for every recipe we have, at 400 covers — what the engine is anchored to.
 * No API calls. Run: `npm run portion:check`.
 */
import fs from "node:fs";
import path from "node:path";
import { PRESETS } from "../lib/engine/sample";
import { parseRecipeText, cardIngredients } from "../lib/engine/demo";
import { derivePortion } from "../lib/engine/portion";

type Case = { name: string; recipeText: string; basePortions: number; portionSize: string };
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, "../lib/data/recipes.seed.json"), "utf8")) as Case[];
const cases: Case[] = [
  ...PRESETS.map((p) => ({ name: p.name, recipeText: p.recipeText, basePortions: p.basePortions, portionSize: p.portionSize })),
  ...seed.map((r) => ({ name: r.name, recipeText: r.recipeText, basePortions: r.basePortions, portionSize: r.portionSize })),
];

const counts = { weight: 0, volume: 0, count: 0, none: 0 };
for (const c of cases) {
  const d = derivePortion({
    ingredients: cardIngredients(parseRecipeText(c.recipeText).ingredients),
    basePortions: c.basePortions,
    targetCovers: 400,
    portionSize: c.portionSize,
  });
  counts[d ? d.kind : "none"]++;
  console.log(`${c.name.slice(0, 30).padEnd(30)} ${(d?.kind || "none").padEnd(6)} | ${c.portionSize.slice(0, 40).padEnd(40)} | ${d ? d.finishedYield : "— (engine's own figure stands)"}`);
  if (d?.kind === "count") console.log(`${"".padEnd(30)}        → ${d.portionSize}`);
}
console.log("");
console.log(`weight ${counts.weight} · volume ${counts.volume} · count ${counts.count} · not derivable ${counts.none} (of ${cases.length})`);
