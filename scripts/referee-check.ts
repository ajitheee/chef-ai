/** Referee regression: portion strings the live engine actually writes + allergen precision. Run: npx tsx scripts/referee-check.ts */
import { validateSheet, detectAllergens, detectLabelDependent } from "../lib/engine/validate";
import type { ProductionSheet } from "../lib/engine/schema";

function sheet(portionSize: string, finishedYield: string, covers = 400): ProductionSheet {
  return {
    dish: "t", mode: "savory",
    baseYield: { portions: 6, portionSize },
    targetYield: { covers, portionSize, finishedYield },
    assumptions: [], ingredients: [{ item: "pork shoulder", scaledQty: "170 lb", unit: "", role: "", baseQty: "", multiplier: "", note: "" }],
    method: [], batching: ["x"], holding: [], pullList: [{ item: "pork", apQty: "170 lb", note: "" }], safetyFlags: [], allergenFlags: [],
  };
}

const cases: [string, string, string][] = [
  ["2 tacos (≈5 oz pork fill per serving)", "125 lb pork fill + taco components", "pass"],
  ["3 oz cooked", "78 lb cooked (+4% buffer)", "pass"],
  ["3 oz cooked", "156 lb cooked (+4% buffer)", "warn"],
  ["Approximately 5 oz cooked pork with 1/2 cup beans per serving", "130 lb (+4% buffer)", "info"],
  ["12 fl oz per serving", "38 gal", "pass"],
  ["1 sandwich per serving", "—", "info"],
  ["4 oz cooked", "50 lb", "warn"],
  ["5 oz pork + 1/2 cup beans per serving", "125 lb pork + 12 gal beans", "info"],
  ["6 oz chicken with 4 oz rice", "150 lb", "info"],
];
let bad = 0;
for (const [portion, finished, expect] of cases) {
  const c = validateSheet(sheet(portion, finished)).find((k) => k.label === "Portion integrity")!;
  const ok = c.status === expect;
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${c.status.padEnd(4)} (want ${expect})  "${portion}" vs "${finished}" — ${c.detail.slice(0, 70)}`);
}

console.log("\nallergen precision:");
const allergenCases: [string, string[]][] = [
  ["coconut milk, corn tortillas, rice noodles, peanut butter, cream of tartar, eggplant, oyster mushrooms, almond flour", ["peanut", "tree nut"]],
  ["chicken thighs, buttermilk, all-purpose flour, eggs", ["milk/dairy", "wheat/gluten", "egg"]],
  ["fish sauce, tofu, sesame oil, cashews", ["fish", "soy", "sesame", "tree nut"]],
  ["olive oil, tomato, basil, kosher salt", []],
  ["mayonnaise, brioche buns, cheddar", ["egg", "wheat/gluten", "milk/dairy"]],
];
for (const [text, want] of allergenCases) {
  const got = detectAllergens(text.toLowerCase()).sort();
  const ok = JSON.stringify(got) === JSON.stringify([...want].sort());
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} [${got.join(", ")}] (want [${want.join(", ")}])  "${text.slice(0, 60)}"`);
}

console.log("\nlabel-dependent products:");
const labelCases: [string, string[]][] = [
  ["romaine, basil pesto, croutons, parmesan", ["pesto", "croutons"]],
  ["chicken thighs, teriyaki sauce, scallions", ["teriyaki sauce"]],
  ["olive oil, tomato, basil, kosher salt", []],
  ["herb ranch dressing, iceberg, bacon", ["ranch dressing"]],
  ["pork shoulder, achiote paste, pineapple, corn tortillas", []],
];
for (const [text, want] of labelCases) {
  const got = detectLabelDependent(text.toLowerCase()).map((h) => h.product);
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? "ok  " : "FAIL"} [${got.join(", ")}] (want [${want.join(", ")}])  "${text}"`);
  if (!ok) bad++;
}

process.exit(bad ? 1 : 0);
