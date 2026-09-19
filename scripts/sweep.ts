/**
 * Sweep: run EVERY recipe we have (the chef's 4 presets + the 50-recipe test
 * library) through the whole deterministic pipeline — demo scaler, referee,
 * purchasing, nutrition, HACCP, prep list, SOP — and report anything that
 * throws, fails validation, or looks wrong. Run: `npm run sweep`.
 * Exit code 1 on hard failures so it can gate a deploy.
 */
import fs from "node:fs";
import path from "node:path";
import { demoScaleFromText } from "../lib/engine/demo";
import { ProductionSheetSchema } from "../lib/engine/schema";
import { validateSheet } from "../lib/engine/validate";
import { estimateNutrition } from "../lib/engine/nutrition";
import { buildHaccp } from "../lib/engine/haccp";
import { buildPrepList, buildSop } from "../lib/engine/ops";
import { PRESETS } from "../lib/engine/sample";

type Case = { name: string; recipeText: string; basePortions: number; portionSize: string };

const seed = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../lib/data/recipes.seed.json"), "utf8")
) as Case[];
const cases: Case[] = [
  ...PRESETS.map((p) => ({ name: p.name, recipeText: p.recipeText, basePortions: p.basePortions, portionSize: p.portionSize })),
  ...seed.map((r) => ({ name: r.name, recipeText: r.recipeText, basePortions: r.basePortions, portionSize: r.portionSize })),
];

const COVERS = 400;
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7).toLowerCase();
const dump = process.argv.includes("--dump");
const selected = only ? cases.filter((c) => c.name.toLowerCase().includes(only)) : cases;
let hard = 0;
let withWarns = 0;
let withIssues = 0;
const unmatchedFreq = new Map<string, number>();

const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s.padEnd(n));

console.log(`Sweeping ${selected.length} recipes at ${COVERS} covers\n`);
console.log(`${pad("recipe", 34)} ing  pull warn  nut%  issues`);
console.log("-".repeat(96));

for (const c of selected) {
  const issues: string[] = [];
  let hardFail = "";
  try {
    const sheet = demoScaleFromText(c.recipeText, c.basePortions, COVERS, c.portionSize, 0, c.name);
    if (sheet.dish !== c.name) issues.push(`dish came out as "${sheet.dish}"`);
    const zod = ProductionSheetSchema.safeParse(sheet);
    if (!zod.success) hardFail = `schema: ${zod.error.issues[0]?.message}`;

    for (const ing of sheet.ingredients) {
      if (/^\d/.test(ing.item)) issues.push(`item starts with a number: "${ing.item}"`);
      if (/(^|\s)#$|NaN|undefined|Infinity/.test(ing.scaledQty)) issues.push(`bad qty "${ing.scaledQty}" for "${ing.item}"`);
      if (!ing.item.trim()) issues.push("empty item name");
    }

    const checks = validateSheet(sheet);
    const warns = checks.filter((k) => k.status === "warn");
    if (warns.length) withWarns++;
    for (const w of warns) issues.push(`referee ${w.label}: ${w.detail}`);

    const nut = estimateNutrition(sheet);
    for (const u of nut.unmatched) unmatchedFreq.set(u, (unmatchedFreq.get(u) ?? 0) + 1);
    if (!nut.ok) issues.push(`nutrition coverage ${Math.round(nut.coverageByWeight * 100)}% (${nut.matched}/${nut.counted}); unmatched: ${nut.unmatched.join(", ") || "-"}`);
    else if (nut.perPortion.kcal > 1500 || nut.perPortion.kcal < 20) issues.push(`implausible ${Math.round(nut.perPortion.kcal)} kcal/portion`);

    const haccp = buildHaccp(sheet);
    if (haccp.entries.length < 6) issues.push(`haccp only ${haccp.entries.length} entries`);
    const prep = buildPrepList(sheet);
    const sop = buildSop(sheet);
    if (!prep.sections.length || !sop.sections.length) issues.push("empty ops doc");

    if (dump) {
      console.log(`\n=== ${c.name} · ${sheet.targetYield.covers} covers @ ${sheet.targetYield.portionSize} · finished ${sheet.targetYield.finishedYield}`);
      for (const ing of sheet.ingredients) console.log(`  ING  ${pad(ing.item, 36)} ${pad(ing.scaledQty, 24)} ${ing.multiplier}`);
      for (const p of sheet.pullList) console.log(`  PULL ${pad(p.item, 36)} ${pad(p.apQty, 18)} ${p.note}`);
      for (const k of checks) console.log(`  CHK  ${k.status.padEnd(4)} ${k.label}: ${k.detail}`);
      for (const l of nut.lines) console.log(`  NUT  ${pad(l.item, 36)} ${pad(l.qty, 22)} ${l.grams == null ? "-" : Math.round(l.grams) + " g"} ${l.label ?? (l.skipped ?? "UNMATCHED")}`);
      const pp = nut.perPortion;
      console.log(`  NUT  per portion: ${Math.round(pp.kcal)} kcal · P ${Math.round(pp.protein)} · C ${Math.round(pp.carbs)} · F ${Math.round(pp.fat)} · Na ${Math.round(pp.sodiumMg)} mg\n`);
    }
    const nutPct = nut.ok ? `${Math.round(nut.coverageByWeight * 100)}%` : `${Math.round(nut.coverageByWeight * 100)}%!`;
    console.log(
      `${pad(c.name, 34)} ${String(sheet.ingredients.length).padStart(3)}  ${String(sheet.pullList.length).padStart(4)} ${String(warns.length).padStart(4)}  ${nutPct.padStart(4)}  ${issues.length ? issues[0].slice(0, 44) + (issues.length > 1 ? ` (+${issues.length - 1})` : "") : "ok"}`
    );
  } catch (e) {
    hardFail = `throws: ${e instanceof Error ? e.message : String(e)}`;
    console.log(`${pad(c.name, 34)} ${hardFail}`);
  }
  if (hardFail) hard++;
  if (issues.length) withIssues++;
  if (issues.length > 1 && process.argv.includes("--verbose")) for (const i of issues.slice(1)) console.log(`      · ${i}`);
}

console.log("-".repeat(96));
console.log(`hard failures: ${hard} · recipes with referee warnings: ${withWarns} · recipes with any issue: ${withIssues} / ${selected.length}`);
const topUnmatched = [...unmatchedFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
if (topUnmatched.length) {
  console.log("\nmost common ingredients with no nutrient entry (extend lib/engine/nutrition.ts):");
  for (const [name, n] of topUnmatched) console.log(`  ${String(n).padStart(2)}x  ${name}`);
}
process.exit(hard ? 1 : 0);
