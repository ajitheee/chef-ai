import type { ProductionSheet } from "./schema";

/** True when no API key is configured — the app runs in demo mode. */
export function isDemoMode(): boolean {
  return !process.env.ANTHROPIC_API_KEY;
}

/**
 * Demo engine (no API key). Deterministically scales the chef's Mexican Rice
 * sample to ANY target cover count, with fixed per-ingredient dampening factors
 * so it both (a) responds to the cover count and (b) shows the non-linear
 * behavior (rice scales full; garlic/cumin/jalapeno dampen). The LIVE engine
 * (with an API key) does this with real reasoning for ANY recipe.
 */

const BASE_PORTIONS = 50;

type BaseIngredient = {
  item: string;
  base: number; // amount for BASE_PORTIONS
  unit: string;
  role: string;
  damp: number; // 1 = linear; <1 = dampened
  kind?: "linear" | "asneeded" | "taste";
  note?: string;
};

// Mexican Rice (REC03579) base = 50 portions @ 3 oz cooked.
const BASE: BaseIngredient[] = [
  { item: "Jasmine rice (dry)", base: 12.5, unit: "cups", role: "structural", damp: 1, note: "structural — defines yield" },
  { item: "Yellow onion, diced", base: 1.5, unit: "cups", role: "flavor_base", damp: 0.94, note: "slight dampen at volume" },
  { item: "Garlic, minced", base: 1, unit: "oz", role: "flavor_base", damp: 0.75, note: "compounds at scale" },
  { item: "Jalapeno, minced", base: 2, unit: "oz", role: "high_impact", damp: 0.62, note: "heat intensifies during hot-hold" },
  { item: "Tomato puree", base: 24, unit: "oz", role: "structural", damp: 1, note: "" },
  { item: "Fire-roasted diced tomato (#10 can)", base: 1, unit: "can", role: "structural", damp: 0.94, note: "acid control at scale" },
  { item: "Ground cumin", base: 1, unit: "Tbsp", role: "high_impact", damp: 0.75, note: "spice perception climbs on the line" },
  { item: "Ground coriander", base: 1, unit: "tsp", role: "high_impact", damp: 0.75, note: "" },
  { item: "Mexican oregano", base: 1, unit: "Tbsp", role: "high_impact", damp: 0.75, note: "" },
  { item: "Kosher salt", base: 1, unit: "Tbsp", role: "high_impact", damp: 1, kind: "taste", note: "do NOT pre-multiply — correct on the line" },
  { item: "Olive/canola oil", base: 0, unit: "", role: "fat", damp: 1, kind: "asneeded", note: "to toast rice in batches" },
  { item: "Cilantro, chopped", base: 1, unit: "bunch", role: "finishing", damp: 0.7, note: "fold in at the pass, not before the hold" },
];

function round(n: number, dp = 1): number {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}

function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : String(round(n));
}

function fmt(value: number, unit: string): string {
  if (unit === "oz" && value >= 16) return `${trim(value / 16)} lb`;
  if (unit === "Tbsp" && value >= 16) return `${trim(value / 16)} cups`;
  if (unit === "tsp" && value >= 48) return `${trim(value / 48)} cups`;
  if (unit === "cups" && value >= 16) return `${trim(value)} cups (~${trim(value / 16)} gal)`;
  if (unit === "can") return `${Math.max(1, Math.round(value))} cans`;
  if (unit === "bunch") return `${Math.max(1, Math.round(value))} bunches`;
  return unit ? `${trim(value)} ${unit}` : trim(value);
}

/** Scale the Mexican Rice sample to `covers`, with dampening. */
export function demoScale(covers: number, portionSize = "3 oz cooked"): ProductionSheet {
  const target = covers > 0 ? covers : BASE_PORTIONS;
  const mult = target / BASE_PORTIONS;

  const ingredients = BASE.map((b) => {
    if (b.kind === "asneeded") {
      const qt = Math.max(1, round((mult * 1) / 8)); // rough, by surface area
      return { item: b.item, scaledQty: `~${qt} qt, as needed`, unit: b.unit, role: b.role, baseQty: "as needed", multiplier: "by surface area", note: b.note || "" };
    }
    if (b.kind === "taste") {
      return { item: b.item, scaledQty: "to taste, in stages", unit: b.unit, role: b.role, baseQty: `${trim(b.base)} ${b.unit}`, multiplier: "staged", note: b.note || "" };
    }
    const eff = mult * b.damp;
    const scaled = b.base * eff;
    const multiplier = b.damp < 1 ? `x${trim(eff)} (dampened)` : `x${trim(mult)}`;
    return {
      item: b.item,
      scaledQty: fmt(scaled, b.unit),
      unit: b.unit,
      role: b.role,
      baseQty: `${trim(b.base)} ${b.unit}`,
      multiplier,
      note: b.note || "",
    };
  });

  // Stock: 2:1 to rice volume (cups), held back ~12% for the line.
  const riceCups = 12.5 * mult;
  const stockGal = (riceCups * 2) / 16;
  const reserveGal = round(stockGal * 0.12);
  ingredients.splice(10, 0, {
    item: "Vegetable stock",
    scaledQty: `${trim(round(stockGal - reserveGal))} gal (+ ${trim(reserveGal)} gal reserve)`,
    unit: "gal",
    role: "structural",
    baseQty: "2:1 to rice",
    multiplier: "2:1 + reserve",
    note: "reserve held to loosen pans during hold",
  });

  const finishedLb = round((target * 3 * 1.04) / 16); // 3 oz portions + 4% buffer
  const pans = Math.max(1, Math.round(target / 16)); // ~16 covers per 4" hotel pan

  return {
    dish: "Mexican Rice",
    mode: "savory",
    baseYield: { portions: BASE_PORTIONS, portionSize: "3 oz cooked" },
    targetYield: { covers: target, portionSize, finishedYield: `${finishedLb} lb cooked (+4% buffer)` },
    assumptions: [
      "Jasmine rice yields ~3x cooked from dry.",
      "Stock at 2:1 to rice by volume (recipe pan method); ~12% held back to loosen on the line.",
      "DEMO PREVIEW — deterministic scale of the sample recipe. Add the API key to scale ANY recipe with the live engine.",
    ],
    ingredients,
    method: [
      "Toast rice in oil in batches until lightly golden — do not crowd.",
      "Sweat onion, then add garlic and jalapeno until fragrant.",
      "Add tomato puree and diced tomato with cumin, coriander, oregano, and salt; toast the rice in 2-3 min.",
      "Divide into 4-inch full hotel pans (~4 cups mix per pan); add stock 2:1 (8 cups per pan).",
      "Cover; combi-steam at 212F for 25-30 min, in batches that fit the combi.",
      "Fluff, fold in cilantro at service. Hold at 135F+.",
    ],
    batching: [
      `${finishedLb} lb finished across ~${pans} hotel pans — build the base in the tilt skillet, then portion into pans for steaming.`,
      "Toast rice in batches; a crowded pan steams instead of toasting and goes gummy.",
      "Don't overload the combi — steam in rack batches so every pan cooks evenly.",
    ],
    holding: [
      "Rice keeps absorbing on the hot line — cook to ~90% and finish toward service.",
      "Hold the stock reserve to loosen pans as they tighten during the hold.",
      "Season slightly UNDER — salt and chili heat climb during hot-hold; correct on the line.",
      "Hold each pan <=90 min and refresh from the line rather than parking all pans at once.",
      "Fold cilantro in at the pass, never into the held pans.",
    ],
    pullList: ingredients
      .filter((i) => i.role !== "fat" && i.item !== "Kosher salt")
      .map((i) => ({ item: i.item, apQty: i.scaledQty, note: "" })),
    safetyFlags: [
      "Hold hot at 135F (57C) or above — check each pan with a calibrated probe.",
      "Cool leftovers 135->70F within 2 h, 70->41F within 4 more h (2-stage cooling).",
    ],
  };
}

/** Back-compat: the default 800-cover sheet. */
export const DEMO_SHEET: ProductionSheet = demoScale(800);
