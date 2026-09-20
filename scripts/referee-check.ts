/** Quick referee regression: portion strings the live engine actually writes. Run: npx tsx scripts/referee-check.ts */
import { validateSheet } from "../lib/engine/validate";
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
  ["Approximately 5 oz cooked pork with 1/2 cup beans per serving", "130 lb (+4% buffer)", "pass"],
  ["12 fl oz per serving", "38 gal", "pass"],
  ["1 sandwich per serving", "—", "info"],
  ["4 oz cooked", "50 lb", "warn"],
];
let bad = 0;
for (const [portion, finished, expect] of cases) {
  const c = validateSheet(sheet(portion, finished)).find((k) => k.label === "Portion integrity")!;
  const ok = c.status === expect;
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${c.status.padEnd(4)} (want ${expect})  "${portion}" vs "${finished}" — ${c.detail.slice(0, 70)}`);
}
process.exit(bad ? 1 : 0);
