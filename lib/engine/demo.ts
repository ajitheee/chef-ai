import type { ProductionSheet } from "./schema";

/** True when no API key is configured — the app runs in demo mode. */
export function isDemoMode(): boolean {
  return !process.env.ANTHROPIC_API_KEY;
}

/**
 * Pre-authored sample output: the chef's Mexican Rice (Centerpointe REC03579),
 * scaled 50 -> 800 covers. Served when no API key is configured so the FULL app
 * flow works end-to-end on his real food. Clearly labeled as demo in the UI —
 * never passed off as live engine work. Replaced by the live engine once a key
 * is set.
 */
export const DEMO_SHEET: ProductionSheet = {
  dish: "Mexican Rice",
  mode: "savory",
  baseYield: { portions: 50, portionSize: "3 oz cooked" },
  targetYield: { covers: 800, portionSize: "3 oz cooked", finishedYield: "150 lb cooked (+4% buffer)" },
  assumptions: [
    "Jasmine rice yields ~3x cooked from dry.",
    "Stock at 2:1 to rice by volume, per the recipe's pan method; ~3 gal held back to loosen on the line.",
    "4% service buffer on finished yield.",
    "DEMO OUTPUT — pre-computed sample on the chef's recipe. Add the API key to scale any recipe live.",
  ],
  ingredients: [
    { item: "Jasmine rice (dry)", scaledQty: "52 lb (~200 cups)", unit: "lb", role: "structural", baseQty: "12.5 cups", multiplier: "x16", note: "structural — defines yield" },
    { item: "Yellow onion, diced", scaledQty: "6 lb (~24 cups)", unit: "lb", role: "flavor_base", baseQty: "1.5 cups", multiplier: "x15", note: "slight dampen at volume" },
    { item: "Garlic, minced", scaledQty: "12 oz", unit: "oz", role: "flavor_base", baseQty: "1 oz", multiplier: "x12 (dampened)", note: "compounds at scale" },
    { item: "Jalapeno, minced", scaledQty: "1.25 lb", unit: "lb", role: "high_impact", baseQty: "2 oz", multiplier: "x10 (dampened)", note: "heat intensifies during hot-hold" },
    { item: "Tomato puree", scaledQty: "3 gal (~384 oz)", unit: "gal", role: "structural", baseQty: "24 oz", multiplier: "x16", note: "" },
    { item: "Fire-roasted diced tomato (#10 can)", scaledQty: "16 cans", unit: "cans", role: "structural", baseQty: "1 can", multiplier: "x16", note: "" },
    { item: "Ground cumin", scaledQty: "12 Tbsp", unit: "Tbsp", role: "high_impact", baseQty: "1 Tbsp", multiplier: "x12 (dampened)", note: "spice perception climbs on the line" },
    { item: "Ground coriander", scaledQty: "4 Tbsp (~12 tsp)", unit: "Tbsp", role: "high_impact", baseQty: "1 tsp", multiplier: "x12 (dampened)", note: "" },
    { item: "Mexican oregano", scaledQty: "12 Tbsp", unit: "Tbsp", role: "high_impact", baseQty: "1 Tbsp", multiplier: "x12 (dampened)", note: "" },
    { item: "Kosher salt", scaledQty: "to taste, in stages", unit: "", role: "high_impact", baseQty: "1 Tbsp", multiplier: "staged", note: "do NOT pre-multiply — correct on the line" },
    { item: "Vegetable stock", scaledQty: "22 gal (+ 3 gal reserve)", unit: "gal", role: "structural", baseQty: "2:1 to rice", multiplier: "2:1 + reserve", note: "reserve held to loosen pans during hold" },
    { item: "Olive/canola oil", scaledQty: "~2 qt, as needed", unit: "qt", role: "fat", baseQty: "as needed", multiplier: "by surface area", note: "to toast rice in batches" },
    { item: "Cilantro, chopped", scaledQty: "12 bunches", unit: "bunches", role: "finishing", baseQty: "1 bunch", multiplier: "practical", note: "fold in at the pass, not before the hold" },
  ],
  method: [
    "Toast rice in oil in batches until lightly golden — do not crowd; toast evenly.",
    "Sweat onion, then add garlic and jalapeno until fragrant.",
    "Add tomato puree and diced tomato with cumin, coriander, oregano, and salt; toast the rice into it 2-3 min.",
    "Divide into 4-inch full hotel pans (~4 cups mix per pan); add vegetable stock 2:1 (8 cups per pan).",
    "Cover tightly; combi-steam at 212F for 25-30 min, in batches that fit the combi.",
    "Fluff, fold in cilantro at service. Hold at 135F+.",
  ],
  batching: [
    "150 lb finished — well beyond one vessel. Build the base in the tilt skillet, then portion into ~50 hotel pans for steaming.",
    "Toast rice in batches; a crowded pan steams instead of toasting and goes gummy.",
    "Don't overload the combi — steam in rack batches so every pan cooks evenly.",
  ],
  holding: [
    "Rice keeps absorbing on the hot line — cook to ~90% and finish toward service.",
    "Hold the 3 gal stock reserve to loosen pans as they tighten during the hold.",
    "Season slightly UNDER — salt and chili heat climb during hot-hold; correct on the line.",
    "Hold each pan <=90 min and refresh from the line rather than parking all 50 pans at once.",
    "Fold cilantro in at the pass, never into the held pans.",
  ],
  pullList: [
    { item: "Jasmine rice (dry)", apQty: "52 lb", note: "" },
    { item: "Yellow onion", apQty: "7 lb AP", note: "before dice trim" },
    { item: "Garlic, peeled", apQty: "12 oz", note: "" },
    { item: "Jalapeno", apQty: "1.5 lb AP", note: "before seed/stem" },
    { item: "Tomato puree", apQty: "3 gal", note: "" },
    { item: "Fire-roasted diced tomato #10", apQty: "16 cans", note: "" },
    { item: "Vegetable stock (or base)", apQty: "25 gal", note: "22 cook + 3 reserve" },
    { item: "Ground cumin", apQty: "12 Tbsp (~3 oz)", note: "" },
    { item: "Ground coriander", apQty: "4 Tbsp", note: "" },
    { item: "Mexican oregano", apQty: "12 Tbsp", note: "" },
    { item: "Olive/canola oil", apQty: "2 qt", note: "" },
    { item: "Cilantro", apQty: "12 bunches", note: "" },
    { item: "Kosher salt", apQty: "bulk, to taste", note: "staged" },
  ],
  safetyFlags: [
    "Hold hot at 135F (57C) or above — check each pan with a calibrated probe.",
    "Cool leftovers 135->70F within 2 h, 70->41F within 4 more h (2-stage cooling).",
  ],
};
