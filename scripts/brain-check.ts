/**
 * Brain check: what the engine would send for every recipe we have — which
 * Knowledge Pack sections retrieval picks, and how big the prompt is. No API
 * calls. Run: `npm run brain:check` (add --verbose for the section titles).
 */
import fs from "node:fs";
import path from "node:path";
import { PRESETS } from "../lib/engine/sample";
import { SYSTEM_PROMPT, buildUserContent, ENGINE_VERSION } from "../lib/engine/prompt";
import { retrieveKnowledge, KNOWLEDGE_SECTIONS, KNOWLEDGE_PACK_VERSION } from "../lib/engine/brain/retrieve";

type Case = { name: string; recipeText: string; basePortions: number; portionSize: string; equipment?: string };
const verbose = process.argv.includes("--verbose");

const seed = JSON.parse(fs.readFileSync(path.join(__dirname, "../lib/data/recipes.seed.json"), "utf8")) as Case[];
const cases: Case[] = [
  ...PRESETS.map((p) => ({ name: p.name, recipeText: p.recipeText, basePortions: p.basePortions, portionSize: p.portionSize, equipment: p.equipment })),
  ...seed.map((r) => ({ name: r.name, recipeText: r.recipeText, basePortions: r.basePortions, portionSize: r.portionSize })),
];

const tokens = (s: string) => Math.round(s.length / 4); // rough, good enough for sizing

console.log(`${ENGINE_VERSION} · system prompt ≈ ${tokens(SYSTEM_PROMPT)} tokens (cached) · Knowledge Pack v${KNOWLEDGE_PACK_VERSION}: ${KNOWLEDGE_SECTIONS.length} sections`);
console.log("");

const counts = new Map<string, number>();
let sumSections = 0;
let sumTokens = 0;
for (const c of cases) {
  const input = {
    dish: c.name,
    recipeText: c.recipeText,
    basePortions: c.basePortions,
    targetCovers: 400,
    portionSize: c.portionSize,
    equipment: c.equipment || "",
    holdingTime: "",
    kitchenNotes: [] as string[],
  };
  const r = retrieveKnowledge(input);
  const content = buildUserContent(input, r.sections);
  const text = typeof content === "string" ? content : JSON.stringify(content);
  sumSections += r.sections.length;
  sumTokens += tokens(text);
  for (const t of r.titles) counts.set(t, (counts.get(t) || 0) + 1);
  const line = `${c.name.slice(0, 34).padEnd(34)} ${String(r.sections.length).padStart(2)} sections  user msg ≈ ${String(tokens(text)).padStart(5)} tok`;
  console.log(verbose ? `${line}\n    ${r.titles.join(" · ")}` : line);
}

console.log("");
console.log(`average: ${(sumSections / cases.length).toFixed(1)} sections, ≈ ${Math.round(sumTokens / cases.length)} user tokens per scale`);
console.log("");
console.log("section retrieval frequency:");
for (const s of KNOWLEDGE_SECTIONS) {
  const n = counts.get(s.title) || 0;
  console.log(`  ${String(n).padStart(3)}/${cases.length}  ${s.title}`);
}
