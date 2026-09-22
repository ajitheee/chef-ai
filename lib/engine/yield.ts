/**
 * Yield & conversion tables (master prompt Modules 10, 12, 14). Standard
 * industry EP/AP yields and volume->weight densities so the pull list shows
 * REAL as-purchased quantities, not recipe (edible-portion) amounts.
 *
 * These are the "tables now" baseline. The chef's real numbers (e.g. "my combi
 * yields 48%") layer in via kitchen memory later and should override these.
 */

export type YieldEntry = { match: RegExp; label: string; yield: number; note: string };

/** Items that are already processed/liquid — never apply a trim yield. */
const NO_YIELD = /stock|broth|bouillon|\bbase\b|powder|sauce|paste|puree|purée|juice|\boil\b|vinegar|canned|\bcan\b|frozen|dried|extract|syrup/i;

/** EP/AP: fraction of the purchased item that ends up usable in the recipe (first match wins). */
export const YIELDS: YieldEntry[] = [
  // cooked-product lines: the card wants COOKED weight; you order the DRY product (cook-up ratio > 1)
  { match: /cooked\s+(white\s+|brown\s+|jasmine\s+|basmati\s+|long[- ]grain\s+)?rice|steamed rice|rice,\s*cooked/i, label: "cooked rice → dry rice", yield: 3, note: "cooks up ~3×" },
  { match: /cooked\s+(pasta|noodles?|spaghetti|penne|macaroni)|pasta,\s*cooked/i, label: "cooked pasta → dry pasta", yield: 2.2, note: "cooks up ~2.2×" },
  { match: /cooked\s+(quinoa|couscous|farro|barley|bulgur)/i, label: "cooked grain → dry grain", yield: 2.8, note: "cooks up ~2.8×" },
  // proteins
  { match: /boneless.*(chicken|thigh|breast)|chicken (breast|thigh|tender)/i, label: "boneless chicken", yield: 0.95, note: "light trim" },
  { match: /whole chicken|bone-in chicken|chicken (leg|quarter|wing|drum)/i, label: "bone-in chicken", yield: 0.7, note: "bone + skin" },
  { match: /ground (beef|pork|turkey|chicken|lamb)/i, label: "ground meat", yield: 1, note: "" },
  { match: /brisket/i, label: "brisket", yield: 0.8, note: "fat-cap trim" },
  { match: /pork (shoulder|butt)/i, label: "pork shoulder", yield: 0.85, note: "bone + fat trim" },
  { match: /pork|ham\b/i, label: "pork", yield: 0.9, note: "trim" },
  { match: /beef|steak|sirloin|chuck|flank|skirt|carne/i, label: "beef", yield: 0.9, note: "trim" },
  { match: /lamb/i, label: "lamb", yield: 0.85, note: "trim" },
  { match: /turkey/i, label: "turkey", yield: 0.9, note: "trim" },
  { match: /whole fish/i, label: "whole fish", yield: 0.45, note: "head, bone, skin" },
  { match: /salmon|cod|tilapia|halibut|tuna|snapper|fish/i, label: "fish fillet", yield: 0.95, note: "light trim" },
  { match: /shell-on|head-on/i, label: "shell-on shrimp", yield: 0.85, note: "shell" },
  { match: /shrimp|prawn/i, label: "shrimp", yield: 0.95, note: "peeled, deveined" },
  // produce
  { match: /onion/i, label: "onion", yield: 0.88, note: "peel + ends" },
  { match: /garlic/i, label: "garlic", yield: 0.87, note: "peel" },
  { match: /shallot/i, label: "shallot", yield: 0.85, note: "peel" },
  { match: /carrot/i, label: "carrot", yield: 0.82, note: "peel + ends" },
  { match: /celery/i, label: "celery", yield: 0.75, note: "base + leaves" },
  { match: /bell pepper|green pepper|red pepper|poblano/i, label: "bell pepper", yield: 0.82, note: "stem + seeds" },
  { match: /jalape|serrano|chile\b|chili pepper|habanero/i, label: "fresh chile", yield: 0.85, note: "stem + seeds" },
  { match: /sweet potato|yam/i, label: "sweet potato", yield: 0.8, note: "peel" },
  { match: /potato/i, label: "potato", yield: 0.81, note: "peel" },
  { match: /tomato/i, label: "fresh tomato", yield: 0.9, note: "core" },
  { match: /lettuce|romaine/i, label: "lettuce", yield: 0.75, note: "outer leaves + core" },
  { match: /cabbage/i, label: "cabbage", yield: 0.8, note: "outer leaves + core" },
  { match: /broccoli/i, label: "broccoli", yield: 0.65, note: "stems" },
  { match: /cauliflower/i, label: "cauliflower", yield: 0.55, note: "leaves + core" },
  { match: /zucchini|squash|cucumber/i, label: "zucchini / cucumber", yield: 0.9, note: "ends" },
  { match: /mushroom/i, label: "mushroom", yield: 0.97, note: "" },
  { match: /spinach|kale|chard/i, label: "greens", yield: 0.8, note: "stems" },
  { match: /cilantro|parsley|basil|mint|dill/i, label: "fresh herbs", yield: 0.6, note: "stems" },
  { match: /avocado/i, label: "avocado", yield: 0.75, note: "pit + skin" },
  { match: /mango/i, label: "mango", yield: 0.65, note: "pit + skin" },
  { match: /pineapple/i, label: "pineapple", yield: 0.5, note: "skin + core" },
  { match: /\b(lime|lemon|orange)s?\b/i, label: "whole citrus", yield: 0.45, note: "juice yield" },
];

export type DensityEntry = { match: RegExp; ozPerCup: number; buyBy: "weight" | "volume"; label: string };

/** Volume -> weight. buyBy=weight items are converted to lb for ordering; liquids stay by volume (first match wins). */
export const DENSITIES: DensityEntry[] = [
  { match: /stock|broth|water|milk|juice|cream|buttermilk|coconut milk|vinegar|wine|beer/i, ozPerCup: 8.3, buyBy: "volume", label: "liquid" },
  { match: /\boil\b|ghee/i, ozPerCup: 7.7, buyBy: "volume", label: "oil" },
  { match: /puree|purée|sauce|salsa|ketchup|passata/i, ozPerCup: 8.8, buyBy: "volume", label: "puree / sauce" },
  { match: /honey|syrup|molasses/i, ozPerCup: 12, buyBy: "volume", label: "syrup" },
  { match: /cooked.*rice|steamed rice|rice,\s*cooked/i, ozPerCup: 5.6, buyBy: "weight", label: "rice, cooked" },
  { match: /cooked.*(pasta|noodle)/i, ozPerCup: 5, buyBy: "weight", label: "pasta, cooked" },
  { match: /cooked.*(quinoa|couscous|farro|barley|bulgur)/i, ozPerCup: 6.5, buyBy: "weight", label: "grain, cooked" },
  { match: /rice/i, ozPerCup: 6.9, buyBy: "weight", label: "rice, dry" },
  { match: /flour|masa|cornmeal/i, ozPerCup: 4.25, buyBy: "weight", label: "flour" },
  { match: /brown sugar/i, ozPerCup: 7.75, buyBy: "weight", label: "brown sugar" },
  { match: /sugar/i, ozPerCup: 7, buyBy: "weight", label: "sugar" },
  { match: /salt/i, ozPerCup: 5, buyBy: "weight", label: "kosher salt" },
  { match: /cumin|paprika|oregano|coriander|chili powder|black pepper|white pepper|cinnamon|turmeric|spice|seasoning|garlic powder|onion powder|cayenne|curry powder/i, ozPerCup: 4, buyBy: "weight", label: "ground spice" },
  { match: /onion|shallot|bell pepper|jalape|celery|carrot|tomato|zucchini|cucumber|squash/i, ozPerCup: 5.6, buyBy: "weight", label: "diced vegetable" },
  { match: /cheese/i, ozPerCup: 4, buyBy: "weight", label: "shredded cheese" },
  { match: /butter/i, ozPerCup: 8, buyBy: "weight", label: "butter" },
  { match: /bean|lentil|chickpea/i, ozPerCup: 6.4, buyBy: "weight", label: "beans" },
  { match: /oat|quinoa|couscous|barley|pasta|noodle/i, ozPerCup: 5.5, buyBy: "weight", label: "dry grain / pasta" },
  { match: /cilantro|parsley|basil|herb/i, ozPerCup: 0.8, buyBy: "weight", label: "chopped herbs" },
  { match: /breadcrumb|panko/i, ozPerCup: 3.5, buyBy: "weight", label: "breadcrumbs" },
];

export function lookupYield(item: string): YieldEntry | null {
  if (NO_YIELD.test(item)) return null;
  return YIELDS.find((y) => y.match.test(item)) ?? null;
}

export function lookupDensity(item: string): DensityEntry | null {
  return DENSITIES.find((d) => d.match.test(item)) ?? null;
}

/* ---------- quantity parsing ---------- */

const W: Record<string, number> = { oz: 1, ounce: 1, ounces: 1, lb: 16, lbs: 16, pound: 16, pounds: 16, g: 0.035274, gram: 0.035274, grams: 0.035274, kg: 35.274 };
const V_CUPS: Record<string, number> = {
  cup: 1, cups: 1, c: 1, gal: 16, gallon: 16, gallons: 16, qt: 4, quart: 4, quarts: 4, pt: 2, pint: 2, pints: 2,
  tbsp: 1 / 16, tsp: 1 / 48, floz: 1 / 8, ml: 0.00423, l: 4.227, liter: 4.227, liters: 4.227,
};

type Parsed = { n: number; unit: string; fam: "weight" | "volume" | "count" };

function parseQty(s: string): Parsed | null {
  const cleaned = s.replace(/[~≈]/g, "").replace(/,/g, "").trim();
  const m = cleaned.match(/(\d+\s*\/\s*\d+|\d+(?:\.\d+)?)\s*(#\s*10\s*cans?|fl\s*oz|[a-zA-Z]+)?/);
  if (!m) return null;
  const numTok = m[1];
  const n = numTok.includes("/") ? Number(numTok.split("/")[0]) / Number(numTok.split("/")[1]) : Number(numTok);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = (m[2] || "").toLowerCase().replace(/\s+/g, "");
  if (unit in W) return { n, unit, fam: "weight" };
  if (unit in V_CUPS) return { n, unit, fam: "volume" };
  return { n, unit, fam: "count" };
}

function fmtWeight(oz: number): string {
  if (oz >= 16) {
    const lb = oz / 16;
    return lb >= 50 ? `${Math.round(lb)} lb` : `${(Math.round(lb * 10) / 10).toString()} lb`;
  }
  return `${Math.round(oz * 10) / 10} oz`;
}

/* ---------- counted units -> weight (for nutrition / sanity math) ---------- */

const G_PER_OZ = 28.3495;

/** Typical weight of one counted unit, in oz. Returns null when we can't justify a number. */
function perUnitOz(item: string, unit: string): number | null {
  const it = item.toLowerCase();
  const u = unit.toLowerCase();
  const tenCan = /#\s*10|\b10\s*cans?\b/.test(it);
  if (/^#\s*10/.test(u) || u === "#" || (u === "" && tenCan)) return 102; // #10 can ≈ 6 lb 6 oz
  if (/^cans?$/.test(u)) return tenCan ? 102 : 15;
  if (/^cases?$/.test(u)) return /can/.test(it) ? 612 : null; // 6 x #10
  if (/^bunch(es)?$/.test(u)) return /scallion|green onion/.test(it) ? 3.5 : /kale|chard|collard/.test(it) ? 8 : 2.5;
  if (/^heads?$/.test(u)) return /garlic/.test(it) ? 1.6 : /cabbage/.test(it) ? 32 : /lettuce|romaine/.test(it) ? 16 : /cauliflower|broccoli/.test(it) ? 30 : null;
  if (/^cloves?$/.test(u)) return 0.1;
  if (/^sprigs?$/.test(u)) return 0.04;
  if (/^dozen$/.test(u)) return /egg/.test(it) ? 21.2 : null;
  if (u === "" || /^(each|ea|pieces?|whole|large|medium|small|portions?|servings?)$/.test(u)) {
    if (/egg/.test(it)) return 1.76;
    if (/onion/.test(it)) return 5.3;
    if (/lime/.test(it)) return 2.4;
    if (/lemon/.test(it)) return 3.5;
    if (/bun|roll/.test(it)) return 1.8;
    if (/tortilla/.test(it)) return 1.4;
    if (/bell pepper/.test(it)) return 4.2;
    if (/jalape/.test(it)) return 0.5;
    if (/potato/.test(it)) return 6;
    if (/avocado/.test(it)) return 5.3;
    if (/chicken breast/.test(it)) return 6;
    if (/chicken thigh/.test(it)) return 4;
    if (/tomato/.test(it)) return 4.3;
    if (/carrot/.test(it)) return 2.2;
    return null;
  }
  return null;
}

/**
 * Convert any recipe quantity string to grams: weight directly, volume via
 * density, counted units via typical unit weights. null = can't justify it.
 */
export function toGrams(item: string, qty: string): { grams: number; how: string } | null {
  const q = parseQty(qty);
  if (!q) return null;
  if (q.fam === "weight") return { grams: q.n * W[q.unit] * G_PER_OZ, how: "weight" };
  if (q.fam === "volume") {
    const cups = q.n * V_CUPS[q.unit];
    const d = lookupDensity(item);
    const ozPerCup = d ? d.ozPerCup : 8.3;
    return { grams: cups * ozPerCup * G_PER_OZ, how: `${d ? d.label : "liquid"} ${ozPerCup} oz/cup` };
  }
  const per = perUnitOz(item, q.unit);
  if (per == null) return null;
  return { grams: q.n * per * G_PER_OZ, how: `${q.unit || "each"} ≈ ${per} oz` };
}

/* ---------- the purchasing pass ---------- */

export type PurchasingResult = { apQty: string; note: string };

/**
 * Turn a recipe (EP) quantity into an as-purchased order quantity:
 *   volume -> weight via density (buy-by-weight items only), then EP -> AP via yield.
 * Leaves liquids (bought by volume) and counted items (cans, bunches) untouched.
 */
export function purchasingLine(item: string, epQty: string): PurchasingResult {
  const q = parseQty(epQty);
  if (!q) return { apQty: epQty, note: "" };
  if (q.fam === "count") {
    if (/^#\s*10/.test(q.unit)) {
      const cases = Math.ceil(q.n / 6);
      return { apQty: epQty, note: `≈ ${cases} case${cases === 1 ? "" : "s"} of 6` };
    }
    return { apQty: epQty, note: "" };
  }

  const density = lookupDensity(item);
  let epOz: number | null = null;
  let via = "";
  if (q.fam === "weight") {
    epOz = q.n * W[q.unit];
  } else if (density && density.buyBy === "weight") {
    epOz = q.n * V_CUPS[q.unit] * density.ozPerCup;
    via = `${epQty} ≈ ${fmtWeight(epOz)} · ${density.label} ${density.ozPerCup} oz/cup`;
  }
  if (epOz == null) return { apQty: epQty, note: "" }; // liquids by volume stay as-is

  const y = lookupYield(item);
  if (y && y.yield > 1) {
    // cook-up: the card's cooked weight ÷ ratio = dry product to order
    const apOz = epOz / y.yield;
    const note = [via, `${fmtWeight(epOz)} cooked needed · ${y.note}`].filter(Boolean).join(" · ");
    return { apQty: `~${fmtWeight(apOz)} dry`, note };
  }
  if (y && y.yield < 1) {
    const apOz = epOz / y.yield;
    const pct = Math.round(y.yield * 100);
    const note = [via, `${fmtWeight(epOz)} EP needed · ${pct}% yield${y.note ? ` (${y.note})` : ""}`].filter(Boolean).join(" · ");
    return { apQty: `~${fmtWeight(apOz)} AP`, note };
  }
  if (via) return { apQty: `~${fmtWeight(epOz)}`, note: via };
  return { apQty: epQty, note: "" };
}

/** Apply the purchasing pass to a whole pull list. */
export function applyPurchasing<T extends { item: string; apQty: string; note?: string }>(pullList: T[]): T[] {
  return pullList.map((it) => {
    const r = purchasingLine(it.item, it.apQty);
    return { ...it, apQty: r.apQty, note: [it.note, r.note].filter(Boolean).join(" · ") };
  });
}

/** Cooked weight as a fraction of raw edible weight — the number every run must agree on. */
export const COOK_YIELDS: { label: string; yield: number }[] = [
  { label: "poultry (roast/grill)", yield: 0.72 },
  { label: "pork shoulder (braise/roast)", yield: 0.65 },
  { label: "pork loin/chops", yield: 0.75 },
  { label: "beef braise/roast (chuck, brisket)", yield: 0.65 },
  { label: "beef steak / grilled whole muscle", yield: 0.75 },
  { label: "ground meat, browned", yield: 0.72 },
  { label: "fish fillet", yield: 0.8 },
  { label: "shrimp", yield: 0.8 },
  { label: "roasted vegetables", yield: 0.8 },
  { label: "sautéed aromatics", yield: 0.7 },
];

/** Compact reference for the live engine's prompt, so both engines use the same standard numbers. */
export function yieldReferenceText(): string {
  const y = YIELDS.filter((e) => e.yield < 1)
    .map((e) => `${e.label} ${Math.round(e.yield * 100)}%`)
    .join(", ");
  const c = COOK_YIELDS.map((e) => `${e.label} ${Math.round(e.yield * 100)}%`).join(", ");
  const d = DENSITIES.filter((e) => e.buyBy === "weight")
    .map((e) => `${e.label} ${e.ozPerCup} oz/cup`)
    .join(", ");
  return [
    `STANDARD EP/AP TRIM YIELDS (edible fraction of as-purchased; override with the chef's own numbers when given): ${y}.`,
    `STANDARD COOKING YIELDS (cooked weight ÷ raw edible weight — use these, don't guess, unless the card or kitchen memory states one): ${c}; dry rice cooks up 3x, dry pasta 2.2x, dry beans 2.5x.`,
    `STANDARD DENSITIES for volume->weight on the pull list: ${d}. Liquids (stock, oil, purees) stay in volume units for ordering.`,
  ].join("\n");
}
