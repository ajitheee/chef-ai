import { KNOWLEDGE_SECTIONS, KNOWLEDGE_PACK_VERSION, type KnowledgeSection } from "./knowledge-pack";

export { KNOWLEDGE_PACK_VERSION, KNOWLEDGE_SECTIONS };
export type { KnowledgeSection };

/**
 * Retrieval over the Knowledge Pack: only the sections relevant to THIS job are
 * sent, so the prompt stays short and the model reads what applies.
 *
 * The pack is small (a few dozen sections), so retrieval is deterministic
 * keyword matching — exact, free, testable, and identical on every run. Each
 * section has a trigger: `always` (the core every scale needs) or a `when`
 * pattern matched against the dish, the recipe card, the portion and the
 * equipment. A section with no trigger is retrieved when its own title words
 * appear in the recipe. Swap this for embeddings if the pack grows past ~50
 * sections.
 */
type Trigger = { always?: true; when?: RegExp; needsNotes?: true };

const TRIGGERS: Record<string, Trigger> = {
  "purpose-and-rule-classes": { always: true },
  "core-finished-yield-equations": { always: true },
  "ap-ep-and-process-yield": { always: true },
  "unit-normalization-and-precision": { always: true },
  "rounding-hierarchy": { always: true },
  "batch-sequencing-holding-and-replenishment": { always: true },
  "validation-tests-before-release": { always: true },
  "weight-volume-and-density": {
    when: /\b(cups?|c\.|tbsp|tablespoons?|tsp|teaspoons?|qt|quarts?|gal(lons?)?|pints?|fl\.? ?oz|ml|liters?|litres?|ladle)\b/i,
  },
  "high-impact-ingredients": {
    when: /\b(salt|soy|tamari|fish sauce|worcestershire|vinegar|lime|lemon|citrus|chil[ei]s?|jalape|serrano|habanero|chipotle|cayenne|hot sauce|sriracha|sambal|gochujang|extracts?|vanilla|bouillon|base|concentrates?|sesame oil|liquid smoke|leaven|baking (?:soda|powder)|yeast|cure|curing|prague|xanthan|gum|msg|adobo|achiote)\b/i,
  },
  // A scratch component made inside the recipe — not "soy sauce" the product.
  "sub-recipe-dependency-scaling": {
    when: /\b(sub-?recipes?|marinade|dressing|vinaigrette|salsa|(?<!\b(?:soy|fish|hot|oyster|hoisin|worcestershire|bbq|tomato)\s)sauces?|pesto|aioli|crema|glaze|spice blend|seasoning blend|(?:dry |spice )rub|filling|topping|slaw|pico|guacamole|chimichurri|tzatziki|raita)\b/i,
  },
  // A composed dish whose portion is a build of components.
  "build-reconciliation": {
    when: /\b(bowls?|tacos?|burritos?|sandwich(?:es)?|wraps?|sliders?|plates?|assembl\w*|compos\w*|layered)\b/i,
  },
  proteins: {
    when: /\b(chicken|beef|pork|steak|turkey|lamb|shrimp|prawns?|fish|salmon|cod|tilapia|tuna|tofu|tempeh|wings?|ribs?|fillets?|thighs?|breasts?|shoulder|brisket|loin|ground|sausage|bacon|ham|meatballs?|carnitas|al pastor|barbacoa)\b/i,
  },
  "rice-grains-legumes-and-absorbed-liquids": {
    when: /\b(rice|quinoa|farro|barley|couscous|bulgur|grits|polenta|oats?|oatmeal|beans?|lentils?|chickpeas?|garbanzos?|legumes?|pinto|black beans|hominy)\b/i,
  },
  "pasta-noodles-and-hydration": {
    when: /\b(pasta|noodles?|spaghetti|penne|macaroni|fettuccine|linguine|rigatoni|ziti|lasagna|orzo|ramen|udon|soba|gnocchi|vermicelli|pho)\b/i,
  },
  "vegetables-fruits-and-herbs": {
    when: /\b(onions?|garlic|tomato(?:es)?|peppers?|carrots?|celery|potato(?:es)?|squash|zucchini|broccoli|spinach|kale|lettuce|romaine|cabbage|cilantro|parsley|basil|herbs?|scallions?|apples?|berries|fruit|mushrooms?|corn|greens|avocados?|cucumbers?)\b/i,
  },
  "sauces-dressings-soups-and-beverages": {
    when: /\b(sauces?|gravy|dressings?|vinaigrette|soups?|stews?|chili|broth|stock|salsa|pur[ée]e|jus|glaze|beverages?|lemonade|tea|juice|smoothie|agua fresca|horchata|reduction|slurry|roux|bisque|chowder|curry)\b/i,
  },
  "baking-dough-and-portioned-products": {
    when: /\b(flour|dough|yeast|bake[ds]?|baking|bread|rolls?|buns?|muffins?|cookies?|cakes?|pastry|pies?|biscuits?|batter|proof(?:ing)?|scones?|brownies?|crust)\b/i,
  },
  "pans-vessels-packages-and-equipment-capacity": {
    when: /\b(hotel pans?|sheet pans?|pans?|kettle|tilt skillet|braiser|combi|ovens?|steamer|fryer|racks?|mixer|blender|vessels?|capacity|full-size|half-size|2-inch|4-inch|6-inch)\b/i,
  },
  // Whole items cut or counted into portions.
  "cut-count-and-discrete-yield": {
    when: /\b(pizzas?|cakes?|loaf|loaves|sheet cake|cut into|wedges?|skewers?|portions? per|per (?:pan|tray|sheet)|quesadillas?|enchiladas?|\d+\s*x\s*\d+ cut)\b/i,
  },
  "procurement-consolidation": {
    when: /\b(cases?|#10|packs?|packages?|order(?:ing)?|purchas\w*|vendor|supplier|cs\b)\b/i,
  },
  "forecasting-with-production-records": { needsNotes: true },
};

export type RetrievalInput = {
  dish?: string;
  recipeText?: string;
  portionSize?: string;
  equipment?: string;
  kitchenNotes?: string[];
};

export type Retrieval = {
  version: string;
  sections: KnowledgeSection[];
  /** Section titles, in the order they are sent — recorded on the sheet. */
  titles: string[];
};

const titleWords = (title: string) =>
  new RegExp("\\b(" + title.toLowerCase().split(/\s+/).filter((w) => w.length > 3).join("|") + ")\\b", "i");

/** Pick the pack sections that apply to this job. Deterministic: same recipe, same sections. */
export function retrieveKnowledge(input: RetrievalInput): Retrieval {
  const haystack = [input.dish, input.recipeText, input.portionSize, input.equipment].filter(Boolean).join("\n");
  const hasNotes = (input.kitchenNotes?.length ?? 0) > 0;

  const scored = KNOWLEDGE_SECTIONS.map((section, order) => {
    const trigger = TRIGGERS[section.id];
    let hits = 0;
    if (!trigger) {
      hits = (haystack.match(titleWords(section.title)) || []).length;
    } else if (trigger.always) {
      hits = Infinity;
    } else if (trigger.needsNotes) {
      hits = hasNotes ? 1 : 0;
    } else if (trigger.when) {
      hits = (haystack.match(new RegExp(trigger.when.source, "gi")) || []).length;
    }
    return { section, order, hits };
  });

  // Everything that matched, in the pack's own order (the pack reads top-down: equations before applications).
  const sections = scored
    .filter((s) => s.hits > 0)
    .sort((a, b) => a.order - b.order)
    .map((s) => s.section);

  return { version: KNOWLEDGE_PACK_VERSION, sections, titles: sections.map((s) => s.title) };
}

/** The retrieved sections as the block sent in the user message. */
export function knowledgeText(sections: KnowledgeSection[]): string {
  if (sections.length === 0) return "";
  const lines = [
    `KNOWLEDGE PACK v${KNOWLEDGE_PACK_VERSION} — sections retrieved for this job (apply them; generic numbers stay working assumptions):`,
  ];
  for (const s of sections) lines.push(``, `## ${s.title}`, s.body);
  return lines.join("\n");
}
