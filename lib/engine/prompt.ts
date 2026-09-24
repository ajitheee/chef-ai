import type Anthropic from "@anthropic-ai/sdk";
import type { ScaleInput } from "./schema";
import { detectSafety, HARD_TEMPS } from "./safety";
import { yieldReferenceText } from "./yield";
import { MASTER_PROMPT, MASTER_PROMPT_VERSION } from "./brain/master-prompt";
import { APP_CONTRACT } from "./brain/contract";
import { knowledgeText, type KnowledgeSection } from "./brain/retrieve";
import { verifiedYieldsText } from "./verified";

/** Engine version — the governing Master Prompt's version, stamped on every sheet. */
export const ENGINE_VERSION = `Kitchen Brain v${MASTER_PROMPT_VERSION}`;

/**
 * The system prompt = the chef's Universal Kitchen Brain Master Prompt, verbatim
 * (docs/kitchen-brain, generated into ./brain/master-prompt.ts), followed by the
 * application contract that maps it onto this app's one-turn structured tool.
 * Knowledge Pack sections are retrieved per job and sent in the user message
 * (./brain/retrieve.ts), so this block is identical call to call and is served
 * from the prompt cache.
 */
export const SYSTEM_PROMPT = `${MASTER_PROMPT}\n\n${APP_CONTRACT}`;

export function buildUserContent(
  input: ScaleInput,
  knowledge: KnowledgeSection[] = [],
  portionLine?: string
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

  if (input.dish && input.dish.trim()) {
    lines.push(`DISH: ${input.dish.trim()}`);
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
  // Finished-yield figures computed in code (portion.ts) — the approved numbers for this job.
  if (portionLine) lines.push(portionLine);
  if (input.equipment && input.equipment.trim()) {
    lines.push(`EQUIPMENT AVAILABLE: ${input.equipment.trim()}`);
  }
  if (input.holdingTime && input.holdingTime.trim()) {
    lines.push(`EXPECTED HOLD TIME ON LINE: ${input.holdingTime.trim()}`);
  }
  if (input.kitchenNotes && input.kitchenNotes.length > 0) {
    lines.push(
      ``,
      `KITCHEN MEMORY — learned corrections from THIS kitchen. Apply them where relevant and note where you did:`
    );
    input.kitchenNotes.forEach((n) => lines.push(`- ${n}`));
  }

  // Retrieved food-safety reference — authoritative, quote verbatim, never compute around.
  const safety = detectSafety(input.recipeText || "");
  if (safety.length > 0) {
    lines.push(``, `FOOD-SAFETY REFERENCE (authoritative — quote these, do NOT compute around them):`);
    safety.forEach((r) => lines.push(`- [${r.domain}] ${r.rule} (${r.source})`));
  }
  lines.push(``, `HARD SAFETY NUMBERS (use verbatim, never invent): ${HARD_TEMPS.join(" ")}`);

  // The Knowledge Pack sections retrieved for this job (see brain/retrieve.ts).
  if (knowledge.length > 0) lines.push(``, knowledgeText(knowledge));

  // The kitchen's own verified yields outrank the standard tables below.
  const verified = verifiedYieldsText(input.yields);
  if (verified) lines.push(``, verified);

  // Standard yield + density tables — working assumptions in the pack's own
  // rule classes: the same numbers the deterministic demo engine uses, so both
  // engines order the same way. Kitchen memory and product data override them.
  lines.push(``, `WORKING-ASSUMPTION TABLES (verified kitchen memory or product data replace them):`, yieldReferenceText());

  lines.push(
    ``,
    `Follow the mandatory scaling workflow, then produce the full production sheet: scaled recipe (effective multipliers + one-line reasons), numbered method, batching plan, hot-line holding notes, and an AP pull list. Run the validation tests before returning. State every working assumption.`
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

/**
 * Variations / options (the creative lens): given a dish or base recipe, propose
 * 2-3 distinct, practical variations for high-volume dining-hall service.
 */
export function buildVariationsMessage(input: {
  dish: string;
  recipeText: string;
  portionSize: string;
  equipment: string;
}): string {
  const lines: string[] = [
    `Propose 2-3 distinct, practical VARIATIONS for high-volume dining-hall service.`,
    ``,
  ];
  if (input.recipeText && input.recipeText.trim()) {
    lines.push(`BASE RECIPE (riff on this, keep its identity):`, input.recipeText.trim(), ``);
  }
  if (input.dish && input.dish.trim()) lines.push(`DISH: ${input.dish.trim()}`);
  if (input.portionSize && input.portionSize.trim()) lines.push(`Portion size: ${input.portionSize.trim()}`);
  if (input.equipment && input.equipment.trim()) lines.push(`Equipment: ${input.equipment.trim()}`);
  lines.push(
    ``,
    `Make the variations meaningfully different — e.g. a base-ingredient swap, a lower-sodium or dietary version, or a version that holds better for a long line. Preserve cultural integrity: keep culturally specific dishes authentic unless a modern/fusion take IS the variation (label it honestly). For each variation give: a clear name, a one-line summary of what changes and why, a complete ingredient list + brief method, base portions, and portion size. Return via the emit_variations tool.`
  );
  return lines.join("\n");
}
