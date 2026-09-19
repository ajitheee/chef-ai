import type { ProductionSheet } from "./schema";

/**
 * Deterministic validation locks (master prompt Module 20). The engine is ASKED
 * to get yield/units/allergens right; this REFEREE checks the finished sheet
 * with plain math, independent of the model. It never trusts the AI's arithmetic
 * blindly — it recomputes and flags drift. Runs the same in demo or live mode.
 */

export type CheckStatus = "pass" | "warn" | "info";
export type Check = { label: string; status: CheckStatus; detail: string };

type Family = "weight" | "volume" | "count";

const UNIT: Record<string, { family: Family; base: number }> = {
  oz: { family: "weight", base: 1 }, ounce: { family: "weight", base: 1 }, ounces: { family: "weight", base: 1 },
  lb: { family: "weight", base: 16 }, lbs: { family: "weight", base: 16 }, pound: { family: "weight", base: 16 }, pounds: { family: "weight", base: 16 },
  g: { family: "weight", base: 0.035274 }, gram: { family: "weight", base: 0.035274 }, grams: { family: "weight", base: 0.035274 },
  kg: { family: "weight", base: 35.274 },
  floz: { family: "volume", base: 1 }, cup: { family: "volume", base: 8 }, cups: { family: "volume", base: 8 },
  pt: { family: "volume", base: 16 }, pint: { family: "volume", base: 16 }, pints: { family: "volume", base: 16 },
  qt: { family: "volume", base: 32 }, quart: { family: "volume", base: 32 }, quarts: { family: "volume", base: 32 },
  gal: { family: "volume", base: 128 }, gallon: { family: "volume", base: 128 }, gallons: { family: "volume", base: 128 },
  tbsp: { family: "volume", base: 0.5 }, tsp: { family: "volume", base: 1 / 6 },
  ml: { family: "volume", base: 0.033814 }, l: { family: "volume", base: 33.814 }, liter: { family: "volume", base: 33.814 }, liters: { family: "volume", base: 33.814 },
  each: { family: "count", base: 1 }, ea: { family: "count", base: 1 }, serving: { family: "count", base: 1 }, servings: { family: "count", base: 1 },
  portion: { family: "count", base: 1 }, portions: { family: "count", base: 1 }, piece: { family: "count", base: 1 }, pieces: { family: "count", base: 1 },
  bunch: { family: "count", base: 1 }, bunches: { family: "count", base: 1 }, can: { family: "count", base: 1 }, cans: { family: "count", base: 1 },
  case: { family: "count", base: 1 }, cases: { family: "count", base: 1 }, bag: { family: "count", base: 1 }, bags: { family: "count", base: 1 },
  head: { family: "count", base: 1 }, heads: { family: "count", base: 1 }, dozen: { family: "count", base: 12 }, count: { family: "count", base: 1 }, ct: { family: "count", base: 1 },
  slice: { family: "count", base: 1 }, slices: { family: "count", base: 1 }, clove: { family: "count", base: 1 }, cloves: { family: "count", base: 1 },
  sprig: { family: "count", base: 1 }, sprigs: { family: "count", base: 1 }, stick: { family: "count", base: 1 }, sticks: { family: "count", base: 1 },
  pkg: { family: "count", base: 1 }, package: { family: "count", base: 1 }, packages: { family: "count", base: 1 }, jar: { family: "count", base: 1 }, jars: { family: "count", base: 1 },
  bottle: { family: "count", base: 1 }, bottles: { family: "count", base: 1 }, box: { family: "count", base: 1 }, boxes: { family: "count", base: 1 },
  sheet: { family: "count", base: 1 }, sheets: { family: "count", base: 1 }, stalk: { family: "count", base: 1 }, stalks: { family: "count", base: 1 },
  ear: { family: "count", base: 1 }, ears: { family: "count", base: 1 }, link: { family: "count", base: 1 }, links: { family: "count", base: 1 }, pc: { family: "count", base: 1 }, pcs: { family: "count", base: 1 },
};

/** The LEADING quantity only — "5 oz pork with 1/2 cup beans" is 5, not 0.5. */
function parseNum(s: string): number | null {
  const cleaned = s.replace(/,/g, " ").replace(/^[^\d]*/, "");
  const mixed = cleaned.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = cleaned.match(/^(\d+)\s*\/\s*(\d+)/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const m = cleaned.match(/^\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/** Parse a "quantity + unit" string into base units (oz for weight, fl oz for volume). */
function parseQ(s: string): { n: number; family: Family; base: number } | null {
  if (!s) return null;
  const n = parseNum(s);
  if (n == null) return null;
  const lower = s.toLowerCase();
  let unit: { family: Family; base: number } | null = null;
  if (/#\s*10\s*cans?/.test(lower)) unit = UNIT.can;
  else if (/\bfl\s*oz\b/.test(lower)) unit = UNIT.floz;
  else {
    for (const key of Object.keys(UNIT)) {
      if (new RegExp(`\\b${key}\\b`).test(lower)) {
        unit = UNIT[key];
        break;
      }
    }
  }
  if (!unit) return null;
  return { n, family: unit.family, base: unit.base };
}

function fmtWeight(oz: number): string {
  if (oz >= 32) {
    const lb = oz / 16;
    return `${lb >= 20 ? Math.round(lb) : lb.toFixed(1)} lb`;
  }
  return `${Math.round(oz)} oz`;
}

const ALLERGENS: Record<string, RegExp> = {
  "milk/dairy": /\b(milk|dairy|butter|cream|cheese|yogurt|buttermilk|ghee|paneer|parmesan|mozzarella)\b/i,
  egg: /\begg/i,
  "wheat/gluten": /\b(wheat|flour|bread|breadcrumb|panko|pasta|noodle|tortilla|bun|soy sauce)\b/i,
  soy: /\b(soy|tofu|edamame|miso|tempeh)\b/i,
  peanut: /\bpeanut/i,
  "tree nut": /\b(almond|walnut|pecan|cashew|pistachio|hazelnut|macadamia)\b/i,
  fish: /\b(fish|salmon|tuna|cod|anchov|halibut)\b/i,
  shellfish: /\b(shrimp|prawn|crab|lobster|mussel|clam|oyster(?!\s*mushroom)|scallop|squid|calamari)\b/i,
  sesame: /\b(sesame|tahini)\b/i,
};

/** Common allergens implied by ingredient names (shared with the HACCP builder). */
export function detectAllergens(text: string): string[] {
  return Object.keys(ALLERGENS).filter((a) => ALLERGENS[a].test(text));
}

/** Run the validation locks against a finished sheet. */
export function validateSheet(sheet: ProductionSheet): Check[] {
  const checks: Check[] = [];
  const covers = sheet.targetYield.covers;

  // 1 — Portion integrity: covers x portion size should equal finished yield.
  const p = parseQ(sheet.targetYield.portionSize);
  const f = parseQ(sheet.targetYield.finishedYield);
  if (p && f && p.family === f.family && p.family !== "count" && covers > 0) {
    const expected = covers * p.n * p.base;
    const actual = f.n * f.base;
    const ratio = actual / expected;
    if (ratio >= 0.85 && ratio <= 1.18) {
      checks.push({
        label: "Portion integrity",
        status: "pass",
        detail: `${covers} × ${sheet.targetYield.portionSize} ≈ ${fmtWeight(expected)}, matches finished yield ${fmtWeight(actual)}`,
      });
    } else {
      const off = Math.round(Math.abs(ratio - 1) * 100);
      checks.push({
        label: "Portion integrity",
        status: "warn",
        detail: `${covers} covers × portion ≈ ${fmtWeight(expected)}, but finished yield says ${fmtWeight(actual)} — ${off}% off. Check the yield.`,
      });
    }
  } else {
    checks.push({
      label: "Portion integrity",
      status: "info",
      detail: "Couldn't auto-verify (portion and yield use different unit types).",
    });
  }

  // 2 — Unit practicality: quantified pull-list items must use kitchen units.
  if (sheet.pullList.length === 0) {
    checks.push({ label: "Unit practicality", status: "info", detail: "No pull list on this sheet." });
  } else {
    const bad = sheet.pullList.filter((it) => /\d/.test(it.apQty) && !parseQ(it.apQty));
    if (bad.length === 0) {
      checks.push({ label: "Unit practicality", status: "pass", detail: `All ${sheet.pullList.length} pull-list quantities use clear kitchen units.` });
    } else {
      checks.push({
        label: "Unit practicality",
        status: "warn",
        detail: `${bad.length} item(s) have unclear units: ${bad.slice(0, 3).map((b) => b.item).join(", ")}${bad.length > 3 ? "…" : ""}`,
      });
    }
  }

  // 3 — Allergen check: ingredients that imply allergens must be flagged.
  // Ingredient names only — a dish called "Chickpea 'Tuna' Salad" contains no fish.
  const text = sheet.ingredients.map((i) => i.item).join(" ").toLowerCase();
  const detected = detectAllergens(text);
  if (detected.length === 0) {
    checks.push({ label: "Allergen check", status: "info", detail: "No common allergens detected in the ingredient names." });
  } else if (sheet.allergenFlags.length > 0) {
    checks.push({ label: "Allergen check", status: "pass", detail: `Detected ${detected.join(", ")} — sheet carries ${sheet.allergenFlags.length} allergen flag(s).` });
  } else {
    checks.push({ label: "Allergen check", status: "warn", detail: `Detected ${detected.join(", ")} in ingredients, but the sheet has no allergen flags.` });
  }

  // 4 — Execution feasibility: large batches must say how to batch.
  if (covers >= 200 && sheet.batching.length === 0) {
    checks.push({ label: "Execution feasibility", status: "warn", detail: `${covers} covers is a large batch, but the sheet has no batching notes.` });
  } else if (sheet.batching.length > 0) {
    checks.push({ label: "Execution feasibility", status: "pass", detail: `Batching noted (${sheet.batching.length} step${sheet.batching.length > 1 ? "s" : ""}).` });
  } else {
    checks.push({ label: "Execution feasibility", status: "info", detail: "Batch size fits normal single-vessel execution." });
  }

  return checks;
}

/** Overall headline: warn if any check warns, else pass (ignoring info-only). */
export function checksHeadline(checks: Check[]): { status: CheckStatus; passed: number; warned: number } {
  const warned = checks.filter((c) => c.status === "warn").length;
  const passed = checks.filter((c) => c.status === "pass").length;
  return { status: warned > 0 ? "warn" : "pass", passed, warned };
}
