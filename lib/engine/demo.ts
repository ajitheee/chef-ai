import type { ProductionSheet, VariationsResult } from "./schema";
import { detectSafety, isFunctionalChemistry } from "./safety";

/** True when no API key is configured — the app runs in demo mode. */
export function isDemoMode(): boolean {
  return !process.env.ANTHROPIC_API_KEY;
}

/** Pre-authored variations of the Mexican Rice sample (demo, no key). */
export function demoVariations(): VariationsResult {
  return {
    dish: "Mexican Rice",
    variations: [
      {
        name: "Cilantro-Lime Rice",
        summary: "Bright, tomato-free version — jasmine finished with lime and extra cilantro. Lighter, crowd favorite.",
        recipeText:
          "Cilantro-Lime Rice\n- 12.5 cups jasmine rice (dry)\n- vegetable stock (2:1 to rice)\n- 1.5 cups yellow onion, diced\n- 1 oz garlic, minced\n- 6 oz lime juice (finish)\n- 3 bunches cilantro, chopped (finish)\n- olive/canola oil, as needed\n- kosher salt, to taste\nMethod: Toast rice in oil, sweat onion + garlic, add stock 2:1, combi-steam 212F 25-30 min. Fluff, fold in lime juice and cilantro at service. Hold 135F+.",
        basePortions: 50,
        portionSize: "3 oz cooked",
        tags: ["base swap", "brighter", "tomato-free"],
      },
      {
        name: "Brown Mexican Rice (higher fiber)",
        summary: "Whole-grain swap for the wellness line — brown jasmine, longer steam, a touch more stock.",
        recipeText:
          "Brown Mexican Rice\n- 12.5 cups brown jasmine rice (dry)\n- vegetable stock (2.25:1 to rice)\n- 1.5 cups onion, 1 oz garlic, 2 oz jalapeno\n- 24 oz tomato puree, 1 #10 fire-roasted diced tomato\n- 1 Tbsp cumin, 1 tsp coriander, 1 Tbsp oregano, salt to taste\n- cilantro to finish\nMethod: As classic, but steam 40-45 min for brown rice and add ~12% more stock. Hold 135F+.",
        basePortions: 50,
        portionSize: "3 oz cooked",
        tags: ["whole grain", "higher fiber", "wellness"],
      },
      {
        name: "Lower-Sodium Mexican Rice",
        summary: "For the healthcare/wellness line — salt cut sharply, brightness and spice raised to compensate.",
        recipeText:
          "Lower-Sodium Mexican Rice\n- 12.5 cups jasmine rice (dry)\n- low-sodium vegetable stock (2:1)\n- 1.5 cups onion, 1.5 oz garlic, 2 oz jalapeno\n- 24 oz no-salt-added tomato puree, 1 #10 no-salt diced tomato\n- 1.25 Tbsp cumin, 1.5 tsp coriander, 1.25 Tbsp oregano\n- 3 oz lime juice + 2 bunches cilantro (finish)\n- salt: minimal, to taste\nMethod: As classic; lean on lime, cumin, oregano, and aromatics for flavor instead of salt. Hold 135F+.",
        basePortions: 50,
        portionSize: "3 oz cooked",
        tags: ["lower sodium", "healthcare line"],
      },
    ],
  };
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
export function demoScale(covers: number, portionSize = "3 oz cooked", notesApplied = 0): ProductionSheet {
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
      ...(notesApplied > 0
        ? [`Applied ${notesApplied} learned kitchen correction${notesApplied > 1 ? "s" : ""} from your kitchen memory.`]
        : []),
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
      "Cool leftovers in shallow pans (reduce depth) — 135->70F within 2 h, 70->41F within 4 more h.",
    ],
    allergenFlags: [
      "No Big-9 allergens in the base recipe — verify the vegetable stock base and seasoning supplier labels before claiming allergen-free.",
    ],
  };
}

/* ---------------------------------------------------------------------------
 * Generic demo scaler — runs on the chef's ACTUAL pasted recipe (no API key).
 * Parses ingredient lines, classifies each by keyword into a role, applies a
 * rough dampening factor, and scales by covers. Clearly labeled as a rough,
 * no-AI estimate. The LIVE engine reasons properly; this just keeps the demo
 * honest ("it understood MY food") instead of always returning Mexican Rice.
 * ------------------------------------------------------------------------- */

type RoleRule = { kw: string[]; role: string; damp: number; kind?: "taste" | "asneeded" | "finishing" };
const ROLE_RULES: RoleRule[] = [
  { kw: ["kosher salt", "sea salt", "salt"], role: "high_impact", damp: 1, kind: "taste" },
  { kw: ["as needed", "for frying", "to coat", "pan spray", "cooking spray"], role: "fat", damp: 1, kind: "asneeded" },
  { kw: ["cilantro", "parsley", "chives", "fresh basil", "mint", "microgreen", "zest", "garnish", "scallion green"], role: "finishing", damp: 0.7, kind: "finishing" },
  { kw: ["garlic", "ginger"], role: "flavor_base", damp: 0.8 },
  { kw: ["onion", "shallot", "leek", "celery", "bell pepper", "green pepper", "tomato paste", "scallion", "mirepoix", "aromatic"], role: "flavor_base", damp: 0.92 },
  { kw: ["jalapeno", "jalapeño", "serrano", "chile", "chili", "cayenne", "pepper flake", "hot sauce", "sriracha", "sambal"], role: "high_impact", damp: 0.62 },
  { kw: ["cumin", "paprika", "oregano", "coriander", "chili powder", "black pepper", "white pepper", "spice", "seasoning", "vinegar", "soy sauce", "fish sauce", "lime juice", "lemon juice", "citrus", "cinnamon", "smoke", "extract", "sugar"], role: "high_impact", damp: 0.72 },
  { kw: ["egg", "cornstarch", "starch", "roux", "gelatin", "xanthan", "breadcrumb", "masa"], role: "binder", damp: 1 },
  { kw: ["oil", "butter", "ghee", "lard"], role: "fat", damp: 1, kind: "asneeded" },
];

const ALLERGEN_KW: { kw: string[]; label: string }[] = [
  { kw: ["milk", "cheese", "butter", "cream", "yogurt", "dairy"], label: "milk/dairy" },
  { kw: ["egg"], label: "egg" },
  { kw: ["wheat", "flour", "bread", "pasta", "soy sauce"], label: "wheat/gluten" },
  { kw: ["soy", "tofu", "edamame", "miso"], label: "soy" },
  { kw: ["peanut"], label: "peanut" },
  { kw: ["almond", "cashew", "walnut", "pecan", "pistachio", "hazelnut", "tree nut"], label: "tree nut" },
  { kw: ["sesame", "tahini"], label: "sesame" },
  { kw: ["shrimp", "crab", "lobster", "shellfish", "clam", "scallop"], label: "shellfish" },
  { kw: ["fish", "salmon", "tuna", "anchovy", "cod"], label: "fish" },
];

function classify(name: string): { role: string; damp: number; kind?: "taste" | "asneeded" | "finishing" } {
  const n = name.toLowerCase();
  for (const r of ROLE_RULES) if (r.kw.some((k) => n.includes(k))) return { role: r.role, damp: r.damp, kind: r.kind };
  return { role: "structural", damp: 1 };
}

type ParsedLine = { name: string; num: number | null; unit: string; raw: string };
function parseLine(line: string): ParsedLine | null {
  let s = line.trim().replace(/^[-*•·]\s*/, "");
  if (!s) return null;
  if (/^(method|prep|directions?|instructions?|serv|note|yield|makes|preparation)\b/i.test(s)) return null;
  const frac = s.match(/^(\d+)\s*\/\s*(\d+)\s*([a-zA-Z#"]+)?\s*(.*)$/);
  const dec = s.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z#"]+)?\s*(.*)$/);
  if (frac) {
    return { num: Number(frac[1]) / Number(frac[2]), unit: (frac[3] || "").toLowerCase(), name: (frac[4] || "").trim() || s, raw: s };
  }
  if (dec) {
    return { num: Number(dec[1]), unit: (dec[2] || "").toLowerCase(), name: (dec[3] || "").trim() || s, raw: s };
  }
  return { num: null, unit: "", name: s, raw: s };
}

function fmtGeneric(value: number, unit: string): string {
  if (unit === "oz" && value >= 16) return `${trim(value / 16)} lb`;
  if (unit === "tbsp" && value >= 16) return `${trim(value / 16)} cups`;
  if ((unit === "cup" || unit === "cups") && value >= 16) return `${trim(value)} cups (~${trim(value / 16)} gal)`;
  return unit ? `${trim(value)} ${unit}` : trim(value);
}

export function demoScaleFromText(
  recipeText: string,
  basePortions: number,
  covers: number,
  portionSize: string,
  notesApplied = 0
): ProductionSheet {
  const lines = recipeText.split("\n");
  const parsed = lines.map(parseLine).filter((p): p is ParsedLine => !!p);
  // Pull a dish name: a leading non-quantity line that isn't an ingredient.
  let dish = "Your recipe";
  if (parsed.length && parsed[0].num === null && parsed[0].name.split(" ").length <= 6) {
    dish = parsed[0].name;
  }
  const ingLines = parsed.filter((p) => p.name && !(p.num === null && p === parsed[0] && dish !== "Your recipe"));

  if (ingLines.length === 0) {
    // Couldn't parse anything useful — fall back to the curated sample.
    return demoScale(covers, portionSize, notesApplied);
  }

  const base = basePortions > 0 ? basePortions : 50;
  const mult = (covers > 0 ? covers : base) / base;
  const allergens = new Set<string>();
  // Brine/cure/pickle/ferment = functional chemistry -> salt & acid scale LINEARLY (never dampen).
  const funcChem = isFunctionalChemistry(recipeText);
  const safetyRules = detectSafety(recipeText);

  const ingredients = ingLines.map((p) => {
    const cls = classify(p.name);
    for (const a of ALLERGEN_KW) if (a.kw.some((k) => p.name.toLowerCase().includes(k))) allergens.add(a.label);
    // In a functional-chemistry prep, salt / cure / acid are ratios, not seasoning.
    const chem = funcChem && (cls.role === "high_impact" || /\b(salt|cure|nitrite|sugar|vinegar|brine)\b/.test(p.name.toLowerCase()));
    const role = chem ? "functional" : cls.role;
    const damp = chem ? 1 : cls.damp;
    const kind = chem ? undefined : cls.kind;

    if (kind === "taste") return { item: p.name, scaledQty: "to taste, in stages", unit: p.unit, role, baseQty: p.raw, multiplier: "staged", note: "season on the line" };
    if (kind === "asneeded") return { item: p.name, scaledQty: "as needed (cook in batches)", unit: p.unit, role, baseQty: p.raw, multiplier: "by surface area", note: "" };
    if (p.num === null) return { item: p.name, scaledQty: "scale to taste", unit: p.unit, role, baseQty: p.raw, multiplier: "", note: "" };
    const eff = mult * damp;
    const scaled = p.num * eff;
    return {
      item: p.name,
      scaledQty: fmtGeneric(scaled, p.unit),
      unit: p.unit,
      role,
      baseQty: `${trim(p.num)} ${p.unit}`.trim(),
      multiplier: chem ? `x${trim(mult)} (ratio held — safety)` : damp < 1 ? `x${trim(eff)} (dampened)` : `x${trim(mult)}`,
      note: chem ? "functional chemistry — scaled to ratio, NOT dampened" : role === "high_impact" && damp < 1 ? "dampened — season up at the end" : "",
    };
  });

  // Finished yield from portion size if it contains oz.
  const ozMatch = portionSize.match(/(\d+(?:\.\d+)?)\s*oz/i);
  const finishedYield = ozMatch ? `${round((covers * Number(ozMatch[1]) * 1.04) / 16)} lb (+4% buffer)` : "—";

  return {
    dish,
    mode: funcChem ? "safety_chemistry" : "savory",
    baseYield: { portions: base, portionSize },
    targetYield: { covers: covers > 0 ? covers : base, portionSize, finishedYield },
    assumptions: [
      ...(notesApplied > 0 ? [`Noted ${notesApplied} kitchen correction${notesApplied > 1 ? "s" : ""} (applied by the live engine).`] : []),
      ...(funcChem ? ["Detected a brine/cure/preservation prep — salt & acid scaled LINEARLY to hold the safety ratio, not dampened."] : []),
      "DEMO PREVIEW — a rough linear+dampening estimate on YOUR recipe (no AI). The live engine reasons about ingredient function, batching, holding & food safety properly. Verify amounts before production.",
    ],
    ingredients,
    method: [],
    batching: [
      "Large volumes exceed single-vessel capacity — cook in batches; don't overcrowd (sear/toast, don't steam).",
      "Cook starches and proteins in batches for even results.",
    ],
    holding: [
      "On a hot line, starches keep absorbing and sauces tighten — cook starches ~90%, hold back some liquid, season under and correct on the line.",
      "Add fresh herbs / crisp items at the pass; hold each batch <=90 min and refresh.",
    ],
    pullList: ingredients
      .filter((i) => i.role !== "fat" && i.role !== "finishing" && !(/salt/i.test(i.item) && !funcChem) && i.scaledQty !== "scale to taste")
      .map((i) => ({ item: i.item, apQty: i.scaledQty, note: "" })),
    safetyFlags: [
      ...safetyRules.map((r) => `[${r.domain}] ${r.rule} (${r.source})`),
      "Hold hot at 135F+; cool leftovers in shallow pans (135->70F within 2 h, 70->41F within 4 more h). Verify against USDA/ServSafe.",
    ],
    allergenFlags:
      allergens.size > 0
        ? [`Possible allergens detected: ${[...allergens].join(", ")}. Verify supplier labels and cross-contact before claiming allergen-free.`]
        : [],
  };
}

/** Back-compat: the default 800-cover sheet. */
export const DEMO_SHEET: ProductionSheet = demoScale(800);
