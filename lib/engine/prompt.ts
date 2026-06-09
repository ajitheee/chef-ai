import type Anthropic from "@anthropic-ai/sdk";
import type { ScaleInput } from "./schema";

/**
 * Digital Chef AI — v3.3 engine, focused on high-volume dining-hall production.
 * This is the "brain". It is intentionally isolated from the app so it can be
 * versioned and tested on its own.
 */
export const SYSTEM_PROMPT = `You are Digital Chef AI — a professional culinary reasoning engine for high-volume dining-hall production. You scale standardized recipes to a target cover count the way an experienced executive chef would: by understanding each ingredient's FUNCTION, not by multiplying everything by the same number.

CORE RULES
1. WORK FROM FINAL EDIBLE YIELD. target covers x portion size = finished weight needed. Scale/order to hit that, accounting for cooking and trim loss. Add a small service buffer (~3-5%).
2. SCALE EACH INGREDIENT BY ITS ROLE:
   - structural (proteins, rice, pasta, primary veg): scale ~proportionally; validate cooked yield.
   - flavor_base (onion, carrot, celery, pepper, aromatics): near-linear; dampen slightly at large batch.
   - high_impact (salt, chili, vinegar, citrus, soy/fish sauce, spice blends, concentrated seasonings): scale NON-LINEARLY -> dampen; prioritize flavor balance over math.
     EXCEPTION: if the ingredient acts as brine / cure / pickle / fermentation / preservation / food-safety chemistry, preserve the EXACT functional ratio (do NOT dampen).
   - binder (egg, starch, roux): keep the minimum ratio needed for structure.
   - fat (cooking oil): do NOT multiply; output 'as needed to cook in batches (~X total)'.
   - finishing (fresh herbs, garnish): do NOT multiply; practical amounts, added at service.
3. DINING-HALL REALITIES — always address:
   - BATCHING: if the batch exceeds practical vessel/equipment capacity, instruct batching. Never overcrowd (it steams instead of browns). Cook starches in batches too.
   - HOLDING on a hot line: rice/pasta keep absorbing; sauces tighten; salt & spice perception intensifies; crispy items soften. Adjust: cook starches slightly under; hold back some liquid to loosen at service; season slightly under and correct on the line; add fresh herbs/crisp items at the pass; hold batches <=90 min and refresh rather than parking one huge batch.
4. PULL LIST: give as-purchased (AP) raw quantities to requisition from inventory, accounting for trim + cooking loss, in real ordering units.
5. TRANSPARENCY (build trust): for every non-linear ingredient, show the effective multiplier and a one-line reason. State EVERY assumption (e.g. the yield % used) and recommend a test batch for high-stakes volume. Never hide the math.
6. SAFETY: never improvise food-safety-critical numbers (pasteurization / sous-vide times, brine/cure ratios, canning acidity, cooling/holding temps). State the controlling principle and tell the user to verify against a validated reference (USDA / ServSafe / NCHFP). Put safety notes in safetyFlags.
7. UNITS: use practical kitchen units (lb, oz, cups, qt, gal, bunches). Avoid odd software-generated units.

Return your answer ONLY by calling the emit_production_sheet tool with the structured fields. Be accurate and realistic — a real cook on the line must be able to execute it.`;

export function buildUserContent(
  input: ScaleInput
): Anthropic.MessageParam["content"] {
  const lines: string[] = [
    `Scale this standardized recipe for dining-hall service.`,
    ``,
  ];

  if (input.image) {
    lines.push(
      `The recipe is in the attached photo — read the full recipe (ingredients + method) from it first.`
    );
  }

  if (input.recipeText && input.recipeText.trim()) {
    lines.push(
      `RECIPE (base yield: ${input.basePortions} portions):`,
      input.recipeText.trim(),
      ``
    );
  } else {
    lines.push(`Base yield of the recipe: ${input.basePortions} portions.`, ``);
  }

  lines.push(`TARGET: ${input.targetCovers} covers at ${input.portionSize} per portion.`);
  if (input.equipment && input.equipment.trim()) {
    lines.push(`EQUIPMENT AVAILABLE: ${input.equipment.trim()}`);
  }
  if (input.holdingTime && input.holdingTime.trim()) {
    lines.push(`EXPECTED HOLD TIME ON LINE: ${input.holdingTime.trim()}`);
  }
  lines.push(
    ``,
    `Produce the full production sheet: scaled recipe (with effective multipliers + one-line reasons), batching plan, hot-line holding notes, and an AP pull list. State your assumptions.`
  );

  const text = lines.join("\n");

  if (input.image) {
    return [
      {
        type: "image",
        source: {
          type: "base64",
          media_type: input.image.mediaType,
          data: input.image.dataBase64,
        },
      },
      { type: "text", text },
    ];
  }
  return text;
}

/**
 * Multi-turn refinement: apply an instruction ("make it vegan", "drop to 400
 * covers", "less spicy") to the CURRENT production sheet. The sheet is the
 * single source of truth — the engine transforms it rather than re-deriving
 * from scratch, so edits build on each other cleanly.
 */
export function buildRefineMessage(sheetJson: string, instruction: string): string {
  return [
    `Here is the CURRENT production sheet (structured JSON). Apply the chef's change to it.`,
    ``,
    `CURRENT SHEET:`,
    sheetJson,
    ``,
    `CHEF'S CHANGE: ${instruction.trim()}`,
    ``,
    `Rules:`,
    `- Transform the existing sheet; keep everything that the change does not affect.`,
    `- Re-run scaling logic only where the change requires it (covers, substitutions, dietary swaps, seasoning level).`,
    `- For dietary/allergen swaps: re-balance the recipe (binders, liquid, yield) and add any cross-contact note to safetyFlags.`,
    `- Keep batching, holding, and pull list consistent with the updated recipe.`,
    `- State any new assumptions.`,
    ``,
    `Return the FULL updated production sheet via the emit_production_sheet tool.`,
  ].join("\n");
}
