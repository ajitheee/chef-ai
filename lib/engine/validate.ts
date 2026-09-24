import type { ProductionSheet } from "./schema";
import { COOK_YIELDS, toGrams } from "./yield";

/** Which standard cooking yield applies to a protein line (first match wins). Shared with portion.ts. */
export const PROTEIN_COOK: [RegExp, string][] = [
  [/ground (beef|pork|turkey|chicken|lamb|meat)|sausage|chorizo|meatball|meatloaf|kofta/i, "ground meat, browned"],
  [/pork shoulder|pork butt|pernil|carnitas|pulled pork|al pastor/i, "pork shoulder (braise/roast)"],
  [/\bpork\b/i, "pork loin/chops"],
  [/brisket|chuck|short rib/i, "beef braise/roast (chuck, brisket)"],
  [/\b(beef|steak|sirloin|flank|skirt|carne)\b/i, "beef steak / grilled whole muscle"],
  [/chicken|turkey|poultry|duck/i, "poultry (roast/grill)"],
  [/shrimp|prawn/i, "shrimp"],
  [/salmon|cod|tilapia|halibut|tuna|snapper|\bfish\b/i, "fish fillet"],
];

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

function toNum(tok: string): number {
  const mixed = tok.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = tok.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  return Number(tok);
}

/**
 * Parse a "quantity + unit" string into base units (oz for weight, fl oz for
 * volume). A unit binds to the number RIGHT BEFORE it — "2 tacos (≈5 oz pork
 * fill per serving)" is 5 oz, not 2 oz. Unknown units return null.
 */
export function parseQuantity(s: string): { n: number; family: Family; base: number } | null {
  return parseQ(s);
}

function parseQ(s: string): { n: number; family: Family; base: number } | null {
  if (!s) return null;
  const lower = s.toLowerCase().replace(/,/g, "");
  if (/#\s*10\s*cans?/.test(lower)) {
    const n = parseNum(lower);
    return n == null ? null : { n, family: "count", base: 1 };
  }
  const fl = lower.match(/(\d+\s+\d+\s*\/\s*\d+|\d+\s*\/\s*\d+|\d+(?:\.\d+)?)\s*fl\.?\s*oz\b/);
  if (fl) return { n: toNum(fl[1]), family: "volume", base: 1 };
  const pair = /(\d+\s+\d+\s*\/\s*\d+|\d+\s*\/\s*\d+|\d+(?:\.\d+)?)\s*([a-z]+)/g;
  let m: RegExpExecArray | null;
  while ((m = pair.exec(lower))) {
    const u = UNIT[m[2]];
    if (u) return { n: toNum(m[1]), family: u.family, base: u.base };
  }
  return null;
}

/** How many "number + known unit" pairs a string carries ("5 oz pork + 1/2 cup beans" = 2). */
export function knownPairs(s: string): number {
  const lower = (s || "").toLowerCase().replace(/,/g, "");
  const pair = /(\d+\s+\d+\s*\/\s*\d+|\d+\s*\/\s*\d+|\d+(?:\.\d+)?)\s*([a-z]+)/g;
  let n = 0;
  let m: RegExpExecArray | null;
  while ((m = pair.exec(lower))) if (UNIT[m[2]] && UNIT[m[2]].family !== "count") n++;
  if (/\bfl\.?\s*oz\b/.test(lower)) n = Math.max(n, 1);
  return n;
}

function fmtWeight(oz: number): string {
  if (oz >= 32) {
    const lb = oz / 16;
    return `${lb >= 20 ? Math.round(lb) : lb.toFixed(1)} lb`;
  }
  return `${Math.round(oz)} oz`;
}

function fmtVolume(floz: number): string {
  if (floz >= 128) {
    const gal = floz / 128;
    return `${gal >= 20 ? Math.round(gal) : gal.toFixed(1)} gal`;
  }
  if (floz >= 32) return `${(floz / 32).toFixed(1)} qt`;
  return `${Math.round(floz)} fl oz`;
}

const fmtBase = (n: number, family: Family) => (family === "volume" ? fmtVolume(n) : fmtWeight(n));

// Precision matters more than recall here: a false allergen flag on a chef's
// sheet costs trust. Plant "milks", nut butters, corn tortillas, rice noodles,
// gluten-free flours and eggplant are excluded explicitly.
const ALLERGENS: Record<string, RegExp> = {
  "milk/dairy":
    /\b(?<!coconut |almond |oat |soy |rice |cashew |nut |hemp )milk\b|\bdairy\b|\b(?<!peanut |almond |cocoa |cashew |sunflower |apple |nut |seed )butter\b|\b(?<!coconut |cashew )cream\b(?!\s+of\s+tartar)|\b(cheese|yogurt|buttermilk|ghee|paneer|parmesan|mozzarella|cheddar|feta|ricotta|queso|cotija|whey|casein|mascarpone|burrata|halloumi)\b/i,
  egg: /\begg(?!plant)s?\b|\bmayonnaise\b|\bmayo\b|\baioli\b|\bhollandaise\b|\bmeringue\b/i,
  "wheat/gluten":
    /\bwheat\b|\b(?<!rice |almond |chickpea |corn |coconut |tapioca |oat |buckwheat |potato |cassava |gluten-free )flour\b|\b(?<!rice |gluten-free )bread\b|\bbreadcrumbs?\b|\bpanko\b|\b(?<!rice |glass |sweet potato |soba |buckwheat |shirataki )noodles?\b|\b(?<!rice |gluten-free |chickpea )pasta\b|\b(?<!corn )tortillas?\b|\bbuns?\b|\bsoy sauce\b|\bseitan\b|\bcouscous\b|\bbarley\b|\bfarro\b|\bbulgur\b|\bsemolina\b|\bpita\b|\bnaan\b|\bbaguette\b|\bbrioche\b|\bcroissant\b/i,
  soy: /\bsoy\b|\bsoya\b|\btofu\b|\bedamame\b|\bmiso\b|\btempeh\b|\btamari\b/i,
  peanut: /\bpeanuts?\b/i,
  "tree nut": /\b(almond|walnut|pecan|cashew|pistachio|hazelnut|macadamia|pine nut|brazil nut|chestnut)s?\b/i,
  fish: /\b(fish|salmon|tuna|cod|anchov\w*|halibut|tilapia|snapper|trout|mahi|sardines?|mackerel|bass|worcestershire)\b/i,
  shellfish: /\b(shrimp|prawns?|crab|lobster|mussels?|clams?|oyster(?!\s*mushroom)s?|scallops?|squid|calamari|crawfish|crayfish)\b/i,
  sesame: /\b(sesame|tahini)\b/i,
};

/**
 * Prepared products whose allergens depend on the label. Typical contents,
 * kept apart from ALLERGENS so the sheet says "verify label", not "contains":
 * a nut-free pesto exists, but a cook must check the tub.
 */
const LABEL_DEPENDENT: [RegExp, string, string[]][] = [
  [/\bpesto\b/i, "pesto", ["tree nut", "milk/dairy"]],
  [/\bhummus\b/i, "hummus", ["sesame"]],
  [/\bcaesar\b/i, "Caesar dressing", ["egg", "fish", "milk/dairy"]],
  [/\branch\b/i, "ranch dressing", ["milk/dairy", "egg"]],
  [/\bteriyaki\b/i, "teriyaki sauce", ["soy", "wheat/gluten"]],
  [/\bhoisin\b/i, "hoisin sauce", ["soy", "wheat/gluten"]],
  [/\bponzu\b/i, "ponzu", ["soy", "wheat/gluten", "fish"]],
  [/\b(?:ton)?katsu sauce\b/i, "katsu sauce", ["soy", "wheat/gluten"]],
  [/\boyster sauce\b/i, "oyster sauce", ["shellfish", "soy"]],
  [/\bgochujang\b|\bdoenjang\b|\bssamjang\b/i, "Korean fermented paste", ["soy", "wheat/gluten"]],
  [/\bkimchi\b/i, "kimchi", ["fish", "shellfish"]],
  [/\bcurry paste\b/i, "curry paste", ["shellfish"]],
  [/\bshrimp paste\b|\bbelacan\b|\bterasi\b/i, "shrimp paste", ["shellfish"]],
  [/\bxo sauce\b/i, "XO sauce", ["shellfish"]],
  [/\bfurikake\b/i, "furikake", ["sesame", "fish"]],
  [/\bchili crisp\b|\bchili oil\b/i, "chili crisp / chili oil", ["soy", "sesame"]],
  [/\bnuoc cham\b|\bnuoc mam\b/i, "nuoc cham", ["fish"]],
  [/\bmole\b/i, "mole", ["tree nut", "peanut", "sesame", "wheat/gluten"]],
  [/\bromesco\b/i, "romesco", ["tree nut"]],
  [/\bsatay\b/i, "satay sauce", ["peanut"]],
  [/\btzatziki\b|\braita\b|\balfredo\b|\bb[ée]chamel\b/i, "dairy-based sauce", ["milk/dairy"]],
  [/\bgravy\b/i, "gravy", ["wheat/gluten"]],
  [/\bcroutons?\b/i, "croutons", ["wheat/gluten"]],
  [/\bbreaded\b|\bbattered\b|\btempura\b/i, "breaded / battered product", ["wheat/gluten"]],
  [/\bwontons?\b|\bdumpling wrappers?\b|\bspring roll wrappers?\b|\bpot ?stickers?\b/i, "wrappers", ["wheat/gluten", "egg"]],
  [/\b(?:chicken|beef|vegetable|veg|soup) base\b|\bbouillon\b/i, "soup base / bouillon", ["soy", "wheat/gluten", "milk/dairy"]],
  [/\bimitation crab\b|\bsurimi\b|\bkrab\b/i, "imitation crab", ["fish", "egg", "wheat/gluten"]],
  [/\bmalt vinegar\b/i, "malt vinegar", ["wheat/gluten"]],
];

export type LabelHit = { product: string; allergens: string[] };

/** Prepared products in the text whose allergens must be read off the label. */
export function detectLabelDependent(text: string): LabelHit[] {
  const seen = new Set<string>();
  const out: LabelHit[] = [];
  for (const [re, product, allergens] of LABEL_DEPENDENT) {
    if (re.test(text) && !seen.has(product)) {
      seen.add(product);
      out.push({ product, allergens });
    }
  }
  return out;
}

/** "pesto (tree nut, milk/dairy); croutons (wheat/gluten)" */
export const labelHitsText = (hits: LabelHit[]) => hits.map((h) => `${h.product} (${h.allergens.join(", ")})`).join("; ");

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
  const multi = knownPairs(sheet.targetYield.portionSize) >= 2 || knownPairs(sheet.targetYield.finishedYield) >= 2;
  if (multi) {
    // "5 oz pork + 1/2 cup beans" / "45 lb chicken + 30 lb rice": one number
    // can't stand for the whole plate — leave it to the chef, don't cry wolf.
    checks.push({
      label: "Portion integrity",
      status: "info",
      detail: "Multi-component portion — verify each component's yield against the pull list.",
    });
  } else if (p && f && p.family === f.family && p.family !== "count" && covers > 0) {
    const expected = covers * p.n * p.base;
    const actual = f.n * f.base;
    const ratio = actual / expected;
    if (ratio >= 0.85 && ratio <= 1.18) {
      checks.push({
        label: "Portion integrity",
        status: "pass",
        detail: `${covers} × ${sheet.targetYield.portionSize} ≈ ${fmtBase(expected, p.family)}, matches finished yield ${fmtBase(actual, p.family)}`,
      });
    } else {
      const off = Math.round(Math.abs(ratio - 1) * 100);
      checks.push({
        label: "Portion integrity",
        status: "warn",
        detail: `${covers} covers × portion ≈ ${fmtBase(expected, p.family)}, but finished yield says ${fmtBase(actual, p.family)} — ${off}% off. Check the yield.`,
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
  const label = detectLabelDependent(text);
  const found = [...detected, ...label.map((h) => h.product)];
  const labelNote = label.length ? ` Verify labels: ${labelHitsText(label)}.` : "";
  if (found.length === 0) {
    checks.push({ label: "Allergen check", status: "info", detail: "No common allergens detected in the ingredient names." });
  } else if (sheet.allergenFlags.length > 0) {
    checks.push({ label: "Allergen check", status: "pass", detail: `Detected ${found.join(", ")} — sheet carries ${sheet.allergenFlags.length} allergen flag(s).${labelNote}` });
  } else {
    checks.push({ label: "Allergen check", status: "warn", detail: `Detected ${found.join(", ")} in ingredients, but the sheet has no allergen flags.${labelNote}` });
  }

  // 5 — Cooked-protein cross-check (INFO only): the biggest raw protein line ×
  // the standard cooking yield, computed here rather than by the model. Shown
  // when it disagrees with the stated finished yield, so the chef sees the
  // deterministic number next to the engine's — never as an alarm.
  const f2 = parseQ(sheet.targetYield.finishedYield);
  let best: { item: string; grams: number; label: string; y: number } | null = null;
  for (const ing of sheet.ingredients) {
    const hit = PROTEIN_COOK.find(([re]) => re.test(ing.item));
    if (!hit) continue;
    const g = toGrams(ing.item, ing.scaledQty);
    if (!g) continue;
    const cy = COOK_YIELDS.find((c) => c.label === hit[1]);
    if (!cy) continue;
    if (!best || g.grams > best.grams) best = { item: ing.item, grams: g.grams, label: hit[1], y: cy.yield };
  }
  if (best && f2 && f2.family === "weight") {
    const rawOz = best.grams / 28.3495;
    const cookedOz = rawOz * best.y;
    const statedOz = f2.n * f2.base;
    const ratio = statedOz / cookedOz;
    if (ratio < 0.75 || ratio > 1.35) {
      checks.push({
        label: "Cooked-protein cross-check",
        status: "info",
        detail: `${fmtWeight(rawOz)} raw ${best.item.toLowerCase()} × ${Math.round(best.y * 100)}% cook yield ≈ ${fmtWeight(cookedOz)} cooked; the sheet states ${fmtWeight(statedOz)}. Order from the pull list; treat the finished figure as approximate.`,
      });
    }
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
