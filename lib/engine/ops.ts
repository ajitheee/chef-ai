import type { ProductionSheet } from "./schema";
import { buildHaccp } from "./haccp";

/**
 * Operations documents (master prompt Module 17), output in copy-code format
 * (Module 19). Built DETERMINISTICALLY from the finished sheet: a prep list
 * grouped by station and by time window, and a one-page SOP. Time windows
 * (day before / morning of / 2 h before / at service / after service) are
 * used instead of invented minute estimates — operationally realistic, never
 * made up.
 */

export type OpsSection = { heading: string; lines: string[] };
export type OpsDoc = { title: string; subtitle: string; sections: OpsSection[] };

type Station = "Butcher & proteins" | "Vegetable prep" | "Dry goods & spices" | "Sauces & liquids" | "Garnish & finishing";
type When = "Day before" | "Morning of" | "2 h before service" | "At service" | "After service";

const STATION_ORDER: Station[] = ["Butcher & proteins", "Vegetable prep", "Dry goods & spices", "Sauces & liquids", "Garnish & finishing"];
const WHEN_ORDER: When[] = ["Day before", "Morning of", "2 h before service", "At service", "After service"];

const PROTEIN = /chicken|beef|pork|lamb|turkey|fish|salmon|cod|tilapia|shrimp|prawn|crab|tofu|\beggs?\b|steak|brisket|sausage|bacon|\bham\b|paneer/;
const PRODUCE = /onion|garlic|shallot|leek|bell pepper|green pepper|red pepper|poblano|jalape|serrano|chile\b|tomato|carrot|celery|lettuce|romaine|cabbage|potato|zucchini|squash|cucumber|mushroom|spinach|kale|chard|broccoli|cauliflower|\bcorn\b|avocado|lime|lemon|orange|apple|mango|pineapple|ginger/;
const FINISHING = /cilantro|parsley|basil|mint|chive|microgreen|zest|garnish|scallion/;
const LIQUID = /stock|broth|sauce|\boil\b|vinegar|juice|puree|purée|milk|cream|water|wine|marinade|honey|syrup/;
const CANNED = /\bcans?\b|#10|canned/;
const MARINADE_PART = /garlic|ginger|onion|cumin|paprika|pepper|coriander|oregano|chili|spice|sugar|vinegar|soy|juice|lime|lemon|\boil\b|yogurt/;

function station(item: string, role: string): Station {
  const t = item.toLowerCase();
  if (role === "finishing" || FINISHING.test(t)) return "Garnish & finishing";
  if (PROTEIN.test(t)) return "Butcher & proteins";
  if (CANNED.test(t)) return "Dry goods & spices";
  if (LIQUID.test(t)) return "Sauces & liquids";
  if (PRODUCE.test(t)) return "Vegetable prep";
  return "Dry goods & spices";
}

// Only the standardized-recipe trailing form ("onion, diced") is a prep step;
// a mid-phrase adjective ("fire-roasted diced tomato") is part of the name.
const DESCRIPTOR = /,\s*(minced|diced|chopped|sliced|julienned|grated|shredded|peeled|crushed|cubed|trimmed)\b.*$/i;
const VERB: Record<string, string> = {
  minced: "Mince", diced: "Dice", chopped: "Chop", sliced: "Slice", julienned: "Julienne", grated: "Grate",
  shredded: "Shred", peeled: "Peel", crushed: "Crush", cubed: "Cube", trimmed: "Trim",
};

function lc(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function taskFor(item: string, st: Station, marinates: boolean): string {
  const d = item.match(DESCRIPTOR);
  const desc = d ? d[1].toLowerCase() : null;
  const name = lc(item.replace(DESCRIPTOR, "").trim());
  switch (st) {
    case "Garnish & finishing":
      return desc ? `${VERB[desc]} ${name} — hold for the pass` : `Pick & prep ${name} — hold for the pass`;
    case "Butcher & proteins":
      return marinates ? `Portion, trim & marinate ${name}` : `Portion & trim ${name}`;
    case "Vegetable prep":
      return desc ? `${VERB[desc]} ${name}` : `Prep ${name}`;
    case "Sauces & liquids":
      return `Measure ${name}`;
    default:
      return CANNED.test(item.toLowerCase()) ? `Open ${name}` : `Weigh ${name}`;
  }
}

type Task = { station: Station; when: When; text: string };

function buildTasks(sheet: ProductionSheet): { tasks: Task[]; marinates: boolean } {
  const blob = [sheet.dish, ...sheet.method, ...sheet.holding, ...sheet.assumptions, ...sheet.ingredients.map((i) => `${i.item} ${i.note}`)]
    .join(" ")
    .toLowerCase();
  const marinates = /marinat|brine|brined|overnight/.test(blob);
  const soaks = /\bsoak/.test(blob);

  const tasks: Task[] = sheet.ingredients.map((ing) => {
    const st = station(ing.item, ing.role);
    const t = ing.item.toLowerCase();
    const toTaste = /to taste|staged/.test(ing.scaledQty);
    const asNeeded = /as needed/.test(ing.scaledQty);

    let when: When = "Morning of";
    let text: string;

    if (st === "Garnish & finishing") {
      when = "At service";
      text = `${taskFor(ing.item, st, marinates)} — ${ing.scaledQty}`;
    } else if (toTaste) {
      when = "At service";
      text = `Season with ${lc(ing.item)} — ${ing.scaledQty} (on the line)`;
    } else if (asNeeded) {
      text = `Set up ${lc(ing.item)} — ${ing.scaledQty}`;
    } else if (st === "Butcher & proteins") {
      when = marinates ? "Day before" : "Morning of";
      text = `${taskFor(ing.item, st, marinates)} — ${ing.scaledQty}`;
    } else if (soaks && /\bbeans?\b|lentil|chickpea/.test(t) && !CANNED.test(t)) {
      when = "Day before";
      text = `Soak ${lc(ing.item)} — ${ing.scaledQty}`;
    } else if (marinates && (st === "Sauces & liquids" || MARINADE_PART.test(t)) && !/stock|broth/.test(t)) {
      when = "Day before";
      text = `${taskFor(ing.item, st, marinates)} — ${ing.scaledQty} (marinade)`;
    } else {
      text = `${taskFor(ing.item, st, marinates)} — ${ing.scaledQty}`;
    }
    if (ing.note && /dampen|ratio|safety/.test(ing.note)) text += ` · ${ing.note}`;
    return { station: st, when, text };
  });

  return { tasks, marinates };
}

function subtitle(sheet: ProductionSheet): string {
  return `${sheet.targetYield.covers} portions @ ${sheet.targetYield.portionSize} · finished ${sheet.targetYield.finishedYield}`;
}

function coolingLine(sheet: ProductionSheet): string {
  return (
    sheet.safetyFlags.find((f) => /cool/i.test(f)) ??
    "Cool leftovers in shallow pans: 135→70°F within 2 h, then 70→41°F within 4 more h (≤6 h total)."
  );
}

/** Prep list: time windows first (what to do when), then station pick-lists. */
export function buildPrepList(sheet: ProductionSheet): OpsDoc {
  const { tasks } = buildTasks(sheet);
  const byWhen = (w: When) => tasks.filter((t) => t.when === w).map((t) => t.text);

  const sections: OpsSection[] = [];
  const dayBefore = byWhen("Day before");
  if (dayBefore.length) sections.push({ heading: "Day before", lines: dayBefore });

  sections.push({ heading: "Morning of", lines: byWhen("Morning of") });

  sections.push({
    heading: "2 h before service",
    lines: [
      ...(sheet.batching.length ? sheet.batching.map((b) => `Batch cook: ${b}`) : ["Cook per the method; this volume fits single-vessel execution."]),
      "Probe every batch to temperature; pan up and move straight to hot holding ≥135°F (57°C).",
    ],
  });

  sections.push({
    heading: "At service",
    lines: [...byWhen("At service"), ...sheet.holding, "Probe every pan at set-up and every 2 h; log it."],
  });

  sections.push({
    heading: "After service",
    lines: [coolingLine(sheet), "Label and date everything held over; discard anything that missed a cooling checkpoint."],
  });

  for (const st of STATION_ORDER) {
    const lines = tasks.filter((t) => t.station === st).map((t) => t.text);
    if (lines.length) sections.push({ heading: `Station · ${st}`, lines });
  }

  return { title: `Prep list — ${sheet.dish}`, subtitle: subtitle(sheet), sections };
}

const EQUIPMENT: [RegExp, string][] = [
  [/combi/i, "combi oven"], [/tilt skillet|tilt-skillet/i, "tilt skillet"], [/kettle/i, "steam kettle"], [/hotel pan/i, "hotel pans"],
  [/sheet (tray|pan)/i, "sheet trays"], [/fryer/i, "fryer"], [/griddle|plancha|flat-?top/i, "griddle"], [/\boven\b/i, "oven"],
  [/rondeau|stock ?pot|pot\b/i, "rondeau / stock pot"], [/mixer/i, "mixer"], [/blast chill/i, "blast chiller"], [/sous vide|circulator/i, "immersion circulator"],
];

/** One-page SOP. */
export function buildSop(sheet: ProductionSheet): OpsDoc {
  const blob = [...sheet.method, ...sheet.batching, ...sheet.holding, ...sheet.assumptions].join(" ");
  const equipment = EQUIPMENT.filter(([re]) => re.test(blob)).map(([, name]) => name);
  const cooking = buildHaccp(sheet).entries.find((e) => e.step === "Cooking");
  const finishing = sheet.ingredients.filter((i) => station(i.item, i.role) === "Garnish & finishing").map((i) => lc(i.item.replace(DESCRIPTOR, "").trim()));

  const procedure = sheet.method.length
    ? sheet.method.map((m, i) => `${i + 1}. ${m}`)
    : [
        "1. Prep every item on the prep list; stage by station.",
        "2. Cook in batches per the batching plan — never overcrowd; probe each batch to temperature.",
        "3. Season under; taste and correct on the line (salt, acid, heat climb during the hold).",
        "4. Pan up in shallow pans and move straight to hot holding ≥135°F.",
      ];

  const safety = [
    ...(cooking ? [`Cook to ${cooking.limit}`] : []),
    "Hot hold ≥135°F (57°C); probe at set-up and every 2 h.",
    coolingLine(sheet),
    ...sheet.safetyFlags.filter((f) => !/cool/i.test(f)),
  ];

  const sections: OpsSection[] = [
    {
      heading: "Yield & portion",
      lines: [
        `Target: ${sheet.targetYield.covers} portions @ ${sheet.targetYield.portionSize}`,
        `Finished yield: ${sheet.targetYield.finishedYield}`,
        `Base recipe: ${sheet.baseYield.portions} portions @ ${sheet.baseYield.portionSize}`,
      ],
    },
    { heading: "Equipment", lines: equipment.length ? equipment : ["Per kitchen standard — confirm vessels against the batching plan."] },
    {
      heading: "Allergens",
      lines: sheet.allergenFlags.length ? sheet.allergenFlags : ["None flagged — verify supplier labels and cross-contact before claiming allergen-free."],
    },
    { heading: "Ingredients (scaled)", lines: sheet.ingredients.map((i) => `${i.item} — ${i.scaledQty}`) },
    { heading: "Procedure", lines: procedure },
    { heading: "Batching", lines: sheet.batching.length ? sheet.batching : ["Fits single-vessel execution at this volume."] },
    { heading: "Holding & service", lines: [...sheet.holding, `Portion ${sheet.targetYield.portionSize} per cover.`] },
    { heading: "Food safety", lines: safety },
    {
      heading: "Quality standard",
      lines: [
        `Finished yield ${sheet.targetYield.finishedYield}; taste for salt, acid and heat before service.`,
        finishing.length ? `Finish at the pass: ${finishing.join(", ")}.` : "Garnish at the pass, never into the held pans.",
      ],
    },
    { heading: "Sign-off", lines: ["Prepared by: ______________   Date: __________", "Verified by (chef / manager): ______________"] },
  ];

  return { title: `SOP — ${sheet.dish}`, subtitle: subtitle(sheet), sections };
}

/** Copy-code format (Module 19): clean, copyable, ready for real use. */
export function opsDocText(doc: OpsDoc): string {
  const out: string[] = [doc.title.toUpperCase(), doc.subtitle, "=".repeat(50)];
  for (const s of doc.sections) {
    out.push("", s.heading.toUpperCase());
    for (const l of s.lines) out.push(`- ${l}`);
  }
  return out.join("\n");
}
