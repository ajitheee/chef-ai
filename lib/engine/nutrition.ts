import type { ProductionSheet } from "./schema";
import { toGrams } from "./yield";

/**
 * Nutrition estimate (master prompt Module 2). Deterministic: standard
 * USDA-style per-100 g averages applied to the scaled (raw) recipe, summed for
 * the batch, divided by covers. "Tables now, real data later" — supplier
 * nutrition facts should replace these before anything is published.
 *
 * Nutrition INFORMS the chef; it never overrides food safety or dish identity
 * (priority 8 of 10 in the master prompt).
 */

export type Macro = { kcal: number; protein: number; carbs: number; fat: number; fiber: number; sodiumMg: number };
type NutrientEntry = { match: RegExp; label: string; per100g: Macro };

const N = (kcal: number, protein: number, carbs: number, fat: number, fiber: number, sodiumMg: number): Macro => ({
  kcal, protein, carbs, fat, fiber, sodiumMg,
});

/** First match wins — specific entries before generic ones. Per 100 g, raw unless noted. */
export const NUTRIENTS: NutrientEntry[] = [
  // stocks & liquids (before the proteins they're named after)
  { match: /low[- ]sodium (stock|broth)|no[- ]salt.*(stock|broth)/i, label: "low-sodium stock", per100g: N(5, 0.4, 0.8, 0.1, 0, 60) },
  { match: /chicken (stock|broth)|beef (stock|broth)/i, label: "meat stock", per100g: N(7, 0.6, 0.9, 0.2, 0, 340) },
  { match: /stock|broth|bouillon/i, label: "vegetable stock", per100g: N(5, 0.3, 1, 0, 0, 300) },
  { match: /coconut milk|coconut cream/i, label: "coconut milk", per100g: N(197, 2, 2.8, 21, 0, 13) },
  { match: /cream cheese/i, label: "cream cheese", per100g: N(342, 6, 4, 34, 0, 320) },
  { match: /sour cream/i, label: "sour cream", per100g: N(198, 2.4, 4.6, 19, 0, 50) },
  { match: /heavy cream|whipping cream|\bcream\b/i, label: "heavy cream", per100g: N(340, 2.8, 2.8, 36, 0, 27) },
  { match: /buttermilk/i, label: "buttermilk", per100g: N(40, 3.3, 4.8, 0.9, 0, 105) },
  { match: /\bmilk\b/i, label: "whole milk", per100g: N(61, 3.2, 4.8, 3.3, 0, 43) },
  { match: /yogurt/i, label: "plain yogurt", per100g: N(61, 3.5, 4.7, 3.3, 0, 46) },
  // sauces & condiments
  { match: /soy sauce|tamari/i, label: "soy sauce", per100g: N(53, 8, 5, 0.6, 0.8, 5493) },
  { match: /fish sauce/i, label: "fish sauce", per100g: N(35, 5, 3.6, 0, 0, 7850) },
  { match: /hot sauce|sriracha|sambal/i, label: "hot sauce", per100g: N(11, 0.5, 1.8, 0.4, 0.3, 2643) },
  { match: /bbq sauce|barbecue sauce/i, label: "BBQ sauce", per100g: N(172, 0.8, 41, 0.6, 0.9, 1000) },
  { match: /ketchup/i, label: "ketchup", per100g: N(101, 1, 27, 0.1, 0.3, 907) },
  { match: /mustard/i, label: "mustard", per100g: N(60, 4, 6, 3.3, 3.3, 1100) },
  { match: /mayo/i, label: "mayonnaise", per100g: N(680, 1, 0.6, 75, 0, 635) },
  { match: /tahini/i, label: "tahini", per100g: N(595, 17, 21, 54, 9, 115) },
  { match: /peanut butter/i, label: "peanut butter", per100g: N(588, 25, 20, 50, 6, 430) },
  { match: /tomato paste/i, label: "tomato paste", per100g: N(82, 4.3, 19, 0.5, 4.1, 60) },
  { match: /tomato (puree|purée|sauce)|crushed tomato|ground tomato|passata/i, label: "tomato purée", per100g: N(38, 1.6, 9, 0.3, 1.9, 130) },
  { match: /diced tomato|canned tomato|fire-roasted/i, label: "canned diced tomato", per100g: N(20, 0.9, 4.4, 0.1, 1, 130) },
  { match: /salsa/i, label: "salsa", per100g: N(36, 1.5, 7, 0.2, 1.9, 430) },
  // fats & oils
  { match: /unsalted butter/i, label: "unsalted butter", per100g: N(717, 0.9, 0.1, 81, 0, 11) },
  { match: /butter|ghee/i, label: "butter (salted)", per100g: N(717, 0.9, 0.1, 81, 0, 640) },
  { match: /\boil\b|shortening|lard/i, label: "oil", per100g: N(884, 0, 0, 100, 0, 0) },
  // proteins
  { match: /chicken breast|boneless.*chicken/i, label: "chicken breast", per100g: N(120, 22.5, 0, 2.6, 0, 45) },
  { match: /chicken thigh/i, label: "chicken thigh", per100g: N(121, 19.7, 0, 4.1, 0, 90) },
  { match: /chicken|turkey|poultry/i, label: "chicken / turkey", per100g: N(143, 20, 0, 6.5, 0, 70) },
  { match: /ground beef|hamburger|beef mince/i, label: "ground beef 80/20", per100g: N(254, 17, 0, 20, 0, 66) },
  { match: /brisket|chuck|short rib/i, label: "beef chuck / brisket", per100g: N(215, 18, 0, 15.5, 0, 63) },
  { match: /beef|steak|sirloin|flank|skirt|carne/i, label: "lean beef", per100g: N(143, 21.5, 0, 5.8, 0, 55) },
  { match: /bacon/i, label: "bacon", per100g: N(417, 12.6, 1.3, 39.7, 0, 662) },
  { match: /\bham\b/i, label: "ham", per100g: N(145, 21, 1.5, 5.5, 0, 1200) },
  { match: /sausage|chorizo/i, label: "pork sausage", per100g: N(300, 16, 1, 26, 0, 700) },
  { match: /pork (shoulder|butt)|pernil/i, label: "pork shoulder", per100g: N(236, 17, 0, 18.5, 0, 63) },
  { match: /pork/i, label: "pork loin", per100g: N(143, 21, 0, 6, 0, 53) },
  { match: /lamb/i, label: "lamb", per100g: N(258, 17, 0, 21, 0, 59) },
  { match: /salmon/i, label: "salmon", per100g: N(208, 20, 0, 13, 0, 59) },
  { match: /tuna|mahi|swordfish/i, label: "tuna / firm fish", per100g: N(130, 28, 0, 1.3, 0, 45) },
  { match: /cod|tilapia|halibut|snapper|whitefish|\bfish\b/i, label: "white fish", per100g: N(96, 21, 0, 1.7, 0, 54) },
  { match: /shrimp|prawn/i, label: "shrimp", per100g: N(85, 20, 0, 0.5, 0, 150) },
  { match: /crab|lobster|scallop|mussel|clam/i, label: "shellfish", per100g: N(85, 18, 1, 1, 0, 300) },
  { match: /\beggs?\b/i, label: "egg", per100g: N(143, 12.6, 0.7, 9.5, 0, 142) },
  { match: /paneer/i, label: "paneer", per100g: N(321, 21, 3.6, 25, 0, 20) },
  { match: /tofu/i, label: "firm tofu", per100g: N(144, 17, 3, 9, 2, 14) },
  { match: /parmesan|pecorino/i, label: "parmesan", per100g: N(431, 38, 4, 29, 0, 1530) },
  { match: /mozzarella/i, label: "mozzarella", per100g: N(280, 28, 3, 17, 0, 630) },
  { match: /feta/i, label: "feta", per100g: N(264, 14, 4, 21, 0, 1140) },
  { match: /cheese/i, label: "cheddar-style cheese", per100g: N(403, 23, 1.3, 33, 0, 620) },
  // grains, starches, legumes
  { match: /brown rice/i, label: "brown rice, dry", per100g: N(370, 7.5, 76, 2.7, 3.5, 4) },
  { match: /\brice\b/i, label: "white rice, dry", per100g: N(365, 7.1, 80, 0.7, 1.3, 5) },
  { match: /quinoa/i, label: "quinoa, dry", per100g: N(368, 14, 64, 6, 7, 5) },
  { match: /pasta|noodle|spaghetti|penne|macaroni/i, label: "pasta, dry", per100g: N(371, 13, 75, 1.5, 3.2, 6) },
  { match: /couscous|barley|farro|bulgur/i, label: "grain, dry", per100g: N(350, 12, 72, 1.5, 6, 8) },
  { match: /\boats?\b|oatmeal/i, label: "oats", per100g: N(389, 17, 66, 7, 10.6, 2) },
  { match: /breadcrumb|panko/i, label: "breadcrumbs", per100g: N(395, 13, 72, 5, 4.5, 500) },
  { match: /flour tortilla/i, label: "flour tortilla", per100g: N(312, 8.3, 51, 8, 3, 730) },
  { match: /tortilla/i, label: "corn tortilla", per100g: N(218, 5.7, 45, 2.9, 6.3, 45) },
  { match: /\bbuns?\b|\brolls?\b|bread|baguette|pita|naan/i, label: "bread / bun", per100g: N(285, 9.5, 52, 3.8, 2.5, 480) },
  { match: /masa|cornmeal|polenta/i, label: "cornmeal / masa", per100g: N(360, 8, 76, 3.5, 7, 5) },
  { match: /flour|cornstarch|starch/i, label: "flour / starch", per100g: N(364, 10, 76, 1, 2.7, 2) },
  { match: /sweet potato|yam/i, label: "sweet potato", per100g: N(86, 1.6, 20, 0.1, 3, 55) },
  { match: /potato/i, label: "potato", per100g: N(77, 2, 17, 0.1, 2.2, 6) },
  { match: /green beans?|string beans?/i, label: "green beans", per100g: N(31, 1.8, 7, 0.2, 2.7, 6) },
  { match: /(pinto|black|kidney|cannellini|navy|refried) beans?|chickpea|garbanzo/i, label: "beans, canned", per100g: N(120, 6.5, 21, 1, 6, 250) },
  { match: /lentil/i, label: "lentils, dry", per100g: N(352, 25, 63, 1, 11, 6) },
  { match: /\bbeans?\b/i, label: "beans, canned", per100g: N(120, 6.5, 21, 1, 6, 250) },
  { match: /\bcorn\b/i, label: "corn kernels", per100g: N(86, 3.3, 19, 1.4, 2.7, 15) },
  // produce
  { match: /garlic powder/i, label: "garlic powder", per100g: N(331, 17, 73, 0.7, 9, 60) },
  { match: /onion powder/i, label: "onion powder", per100g: N(341, 10, 79, 1, 15, 73) },
  { match: /garlic/i, label: "garlic", per100g: N(149, 6.4, 33, 0.5, 2.1, 17) },
  { match: /onion|shallot|leek/i, label: "onion", per100g: N(40, 1.1, 9.3, 0.1, 1.7, 4) },
  { match: /carrot/i, label: "carrot", per100g: N(41, 0.9, 9.6, 0.2, 2.8, 69) },
  { match: /celery/i, label: "celery", per100g: N(14, 0.7, 3, 0.2, 1.6, 80) },
  { match: /bell pepper|green pepper|red pepper|poblano/i, label: "bell pepper", per100g: N(26, 1, 6, 0.3, 2.1, 4) },
  { match: /jalape|serrano|chile\b|chili pepper|habanero/i, label: "fresh chile", per100g: N(29, 0.9, 6.5, 0.4, 2.8, 3) },
  { match: /tomato/i, label: "fresh tomato", per100g: N(18, 0.9, 3.9, 0.2, 1.2, 5) },
  { match: /lettuce|romaine|greens|arugula/i, label: "lettuce", per100g: N(17, 1.2, 3.3, 0.3, 2.1, 8) },
  { match: /spinach|kale|chard/i, label: "spinach / kale", per100g: N(23, 2.9, 3.6, 0.4, 2.2, 79) },
  { match: /cabbage|slaw/i, label: "cabbage", per100g: N(25, 1.3, 6, 0.1, 2.5, 18) },
  { match: /broccoli|cauliflower/i, label: "broccoli / cauliflower", per100g: N(34, 2.8, 6.6, 0.4, 2.6, 33) },
  { match: /mushroom/i, label: "mushroom", per100g: N(22, 3.1, 3.3, 0.3, 1, 5) },
  { match: /zucchini|squash|cucumber|eggplant/i, label: "zucchini / cucumber", per100g: N(17, 1.2, 3.1, 0.3, 1, 8) },
  { match: /avocado/i, label: "avocado", per100g: N(160, 2, 8.5, 15, 6.7, 7) },
  { match: /pineapple|mango|banana|apple|berr/i, label: "fruit", per100g: N(60, 0.7, 15, 0.3, 2, 1) },
  { match: /lime juice|lemon juice|orange juice|citrus/i, label: "citrus juice", per100g: N(25, 0.4, 8, 0.2, 0.3, 1) },
  { match: /\b(lime|lemon|orange)s?\b/i, label: "whole citrus", per100g: N(30, 0.7, 10, 0.3, 2.8, 2) },
  { match: /cilantro|parsley|basil|mint|dill|chive|scallion|herb/i, label: "fresh herbs", per100g: N(30, 2.5, 4, 0.6, 2.8, 40) },
  // sweeteners, acids, seasonings
  { match: /brown sugar|piloncillo/i, label: "brown sugar", per100g: N(380, 0, 98, 0, 0, 28) },
  { match: /honey|maple|agave|syrup|molasses/i, label: "syrup / honey", per100g: N(304, 0.3, 82, 0, 0.2, 4) },
  { match: /sugar/i, label: "sugar", per100g: N(387, 0, 100, 0, 0, 1) },
  { match: /vinegar/i, label: "vinegar", per100g: N(18, 0, 0.9, 0, 0, 2) },
  { match: /\bwine\b|sake|mirin|beer/i, label: "wine / cooking alcohol", per100g: N(85, 0.1, 2.6, 0, 0, 5) },
  { match: /kosher salt|sea salt|\bsalt\b/i, label: "salt", per100g: N(0, 0, 0, 0, 0, 38758) },
  { match: /chili powder/i, label: "chili powder (blend)", per100g: N(282, 13.5, 50, 14, 35, 1640) },
  { match: /curry powder|garam masala/i, label: "curry powder", per100g: N(325, 14, 56, 14, 53, 52) },
  { match: /cumin|coriander|paprika|oregano|black pepper|white pepper|cayenne|cinnamon|turmeric|thyme|rosemary|bay|clove|nutmeg|allspice|spice|seasoning|pepper/i, label: "dried spice", per100g: N(330, 13, 50, 15, 25, 80) },
  { match: /cocoa/i, label: "cocoa powder", per100g: N(228, 20, 58, 14, 33, 21) },
  { match: /chocolate/i, label: "dark chocolate", per100g: N(546, 5, 61, 31, 7, 24) },
  { match: /sesame|nuts?\b|almond|walnut|pecan|cashew|pistachio|peanut/i, label: "nuts / seeds", per100g: N(580, 20, 21, 50, 8, 10) },
];

function lookup(item: string): NutrientEntry | null {
  return NUTRIENTS.find((n) => n.match.test(item)) ?? null;
}

const SKIP = /to taste|as needed|staged|scale to taste/i;

export type SodiumLevel = "low" | "moderate" | "high" | "very high";

export type NutritionLine = { item: string; qty: string; grams: number | null; label: string | null; skipped?: string };
export type NutritionEstimate = {
  ok: boolean; // enough coverage to show per-portion numbers
  covers: number;
  perPortion: Macro;
  total: Macro;
  split: { protein: number; carbs: number; fat: number }; // % of calories
  sodiumLevel: SodiumLevel;
  coverageByWeight: number; // 0..1 of parsed grams that matched a nutrient entry
  matched: number;
  counted: number; // ingredients with a parseable quantity
  unmatched: string[]; // parsed but no nutrient entry
  skipped: string[]; // no usable quantity (to taste / as needed)
  saltToTaste: boolean;
  lines: NutritionLine[];
};

const ZERO: Macro = N(0, 0, 0, 0, 0, 0);
const add = (a: Macro, b: Macro, f: number): Macro => ({
  kcal: a.kcal + b.kcal * f, protein: a.protein + b.protein * f, carbs: a.carbs + b.carbs * f,
  fat: a.fat + b.fat * f, fiber: a.fiber + b.fiber * f, sodiumMg: a.sodiumMg + b.sodiumMg * f,
});
const scale = (m: Macro, f: number): Macro => add(ZERO, m, f);

/** FDA-based bands: ≤140 mg "low sodium" claim; ≥20% DV (460 mg) counts as high; 2,300 mg DV. */
export function sodiumLevel(mg: number): SodiumLevel {
  if (mg <= 140) return "low";
  if (mg <= 460) return "moderate";
  if (mg <= 920) return "high";
  return "very high";
}

export function estimateNutrition(sheet: ProductionSheet): NutritionEstimate {
  const covers = sheet.targetYield.covers > 0 ? sheet.targetYield.covers : 1;
  let total = ZERO;
  let matchedGrams = 0;
  let parsedGrams = 0;
  let matched = 0;
  let counted = 0;
  const unmatched: string[] = [];
  const skipped: string[] = [];
  let saltToTaste = false;
  const lines: NutritionLine[] = [];

  for (const ing of sheet.ingredients) {
    // "to taste" / "as needed" with NO number can't be counted. An "as needed"
    // line that carries a realistic estimate ("~2 qt, as needed" for pan oil)
    // IS counted — process fat is real calories (master prompt Module 4).
    if (!/\d/.test(ing.scaledQty)) {
      if (/salt/i.test(ing.item) && SKIP.test(ing.scaledQty)) saltToTaste = true;
      skipped.push(ing.item);
      lines.push({ item: ing.item, qty: ing.scaledQty, grams: null, label: null, skipped: "no fixed quantity" });
      continue;
    }
    const g = toGrams(ing.item, ing.scaledQty);
    if (!g) {
      skipped.push(ing.item);
      lines.push({ item: ing.item, qty: ing.scaledQty, grams: null, label: null, skipped: "unit not convertible" });
      continue;
    }
    counted++;
    parsedGrams += g.grams;
    const entry = lookup(ing.item);
    if (!entry) {
      unmatched.push(ing.item);
      lines.push({ item: ing.item, qty: ing.scaledQty, grams: g.grams, label: null });
      continue;
    }
    matched++;
    matchedGrams += g.grams;
    total = add(total, entry.per100g, g.grams / 100);
    lines.push({ item: ing.item, qty: ing.scaledQty, grams: g.grams, label: entry.label });
  }

  const perPortion = scale(total, 1 / covers);
  const kcal = perPortion.kcal || 1;
  const split = {
    protein: Math.round(((perPortion.protein * 4) / kcal) * 100),
    carbs: Math.round(((perPortion.carbs * 4) / kcal) * 100),
    fat: Math.round(((perPortion.fat * 9) / kcal) * 100),
  };
  const coverageByWeight = parsedGrams > 0 ? matchedGrams / parsedGrams : 0;

  return {
    ok: matched > 0 && coverageByWeight >= 0.6,
    covers,
    perPortion,
    total,
    split,
    sodiumLevel: sodiumLevel(perPortion.sodiumMg),
    coverageByWeight,
    matched,
    counted,
    unmatched,
    skipped,
    saltToTaste,
    lines,
  };
}
