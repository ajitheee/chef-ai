import type { ProductionSheet } from "./schema";

/** True when no API key is configured — the app runs in demo mode. */
export function isDemoMode(): boolean {
  return !process.env.ANTHROPIC_API_KEY;
}

/**
 * Pre-authored, chef-reviewed sample output (jambalaya, 50 -> 850 covers).
 * Served when no API key is configured so the FULL app flow works end-to-end.
 * Clearly labeled as demo output in the UI — never passed off as live engine work.
 */
export const DEMO_SHEET: ProductionSheet = {
  dish: "Chicken & Andouille Jambalaya",
  mode: "savory",
  baseYield: { portions: 50, portionSize: "10 oz" },
  targetYield: { covers: 850, portionSize: "10 oz", finishedYield: "531 lb (+4% service buffer)" },
  assumptions: [
    "Chicken thigh cook loss assumed ~28% (braise/simmer) — fire a test batch to confirm before full production.",
    "Rice absorption ratio assumed ~1:1.6 dry-to-stock for batch cooking in combi/kettle.",
    "4% service buffer included on finished yield.",
    "DEMO OUTPUT — this is a pre-computed sample. Add the API key to scale any recipe live.",
  ],
  ingredients: [
    { item: "Boneless chicken thigh, diced", scaledQty: "136 lb AP", unit: "lb", role: "structural", baseQty: "8 lb", multiplier: "x17", note: "linear — drives portion structure; ~98 lb cooked" },
    { item: "Andouille sausage, sliced", scaledQty: "68 lb", unit: "lb", role: "structural", baseQty: "4 lb", multiplier: "x17", note: "" },
    { item: "Long-grain rice (dry)", scaledQty: "102 lb", unit: "lb", role: "structural", baseQty: "6 lb", multiplier: "x17", note: "structural — defines yield" },
    { item: "Chicken stock", scaledQty: "26 gal (+ 4 gal reserve)", unit: "gal", role: "structural", baseQty: "1.5 gal", multiplier: "x17 cook + reserve", note: "reserve held back for the hot line" },
    { item: "Yellow onion, diced", scaledQty: "45 lb", unit: "lb", role: "flavor_base", baseQty: "3 lb", multiplier: "x15", note: "slight dampen at volume" },
    { item: "Green bell pepper, diced", scaledQty: "34 lb", unit: "lb", role: "flavor_base", baseQty: "2 lb", multiplier: "x17", note: "" },
    { item: "Celery, diced", scaledQty: "24 lb", unit: "lb", role: "flavor_base", baseQty: "1.5 lb", multiplier: "x16", note: "slight dampen" },
    { item: "Garlic, minced", scaledQty: "3.5 lb", unit: "lb", role: "flavor_base", baseQty: "4 oz", multiplier: "x13 (dampened)", note: "mellows in the cook but compounds at volume" },
    { item: "Diced tomato (#10 can)", scaledQty: "15 cans", unit: "cans", role: "high_impact", baseQty: "1 can", multiplier: "x15", note: "acid control at scale" },
    { item: "Cajun seasoning", scaledQty: "11 cups", unit: "cups", role: "high_impact", baseQty: "1 cup", multiplier: "x11 (dampened hard)", note: "salt + cayenne intensify on the hot line" },
    { item: "Salt", scaledQty: "to taste, in stages", unit: "", role: "high_impact", baseQty: "to taste", multiplier: "staged", note: "do NOT pre-multiply — braise concentrates" },
    { item: "Neutral oil", scaledQty: "~3 qt, as needed", unit: "qt", role: "fat", baseQty: "as needed", multiplier: "by surface area", note: "for browning in batches, not by recipe volume" },
    { item: "Green onion, sliced", scaledQty: "8 bunches", unit: "bunches", role: "finishing", baseQty: "to finish", multiplier: "practical", note: "add at the pass, not in the batch" },
    { item: "Parsley, chopped", scaledQty: "4 bunches", unit: "bunches", role: "finishing", baseQty: "to finish", multiplier: "practical", note: "add fresh at service" },
  ],
  method: [
    "Brown chicken and sausage in batches in the tilt skillet — do not overcrowd; brown, don't steam.",
    "Sweat onion, pepper, celery, then garlic until translucent.",
    "Add tomato and Cajun seasoning; cook out 2–3 minutes.",
    "Add rice and stock; bring to a simmer, then cover and cook in batches (tilt skillet + kettle or combi pans) until rice is ~90% done.",
    "Rest covered 10 min, fluff. Season in stages, tasting each batch.",
    "Finish each pan at the pass with green onion and parsley.",
  ],
  batching: [
    "531 lb finished volume cannot be cooked in one vessel — split across tilt skillet + 40-gal kettle, or 4–6 rondeau/combi batches.",
    "Brown proteins in batches: crowding the pan steams instead of sears.",
    "Cook rice in batches — one oversized pot cooks unevenly and goes gummy.",
  ],
  holding: [
    "Rice keeps absorbing liquid on the hot line — cook to ~90% and finish toward service.",
    "Hold the 4 gal stock reserve to loosen each pan as it tightens during the 2-hour hold.",
    "Season slightly UNDER — salt and spice perception climbs during hot-hold; correct on the line.",
    "Hold each batch ≤90 min and refresh pans rather than parking one large batch for the full service.",
    "Green onion and parsley go on at the pass, never into the held batch.",
  ],
  pullList: [
    { item: "Chicken thigh, boneless", apQty: "136 lb", note: "" },
    { item: "Andouille sausage", apQty: "68 lb", note: "" },
    { item: "Long-grain rice", apQty: "102 lb", note: "" },
    { item: "Chicken stock", apQty: "30 gal", note: "26 cook + 4 reserve" },
    { item: "Yellow onion", apQty: "45 lb", note: "" },
    { item: "Green bell pepper", apQty: "34 lb", note: "" },
    { item: "Celery", apQty: "24 lb", note: "" },
    { item: "Garlic, peeled", apQty: "3.5 lb", note: "" },
    { item: "Diced tomato #10", apQty: "15 cans", note: "" },
    { item: "Cajun seasoning", apQty: "11 cups (~3.5 lb)", note: "" },
    { item: "Neutral oil", apQty: "3 qt", note: "" },
    { item: "Green onion", apQty: "8 bunches", note: "" },
    { item: "Parsley", apQty: "4 bunches", note: "" },
    { item: "Kosher salt", apQty: "bulk, to taste", note: "staged seasoning" },
  ],
  safetyFlags: [
    "Hold hot at 135°F (57°C) or above; check with a calibrated probe each batch.",
    "Cool any leftovers 135→70°F within 2 h, 70→41°F within 4 more h (2-stage cooling).",
  ],
};
