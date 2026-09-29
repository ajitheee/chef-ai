import { scaleRecipe, engineFailure, type EngineUsage } from "./claude";
import { ENGINE_VERSION } from "./prompt";
import type { ScaleInput, ProductionSheet } from "./schema";
import { isDemoMode, demoScale, demoScaleFromText } from "./demo";
import { SAMPLE } from "./sample";
import { plainSheet } from "./plain";

/**
 * One scale job, the same whoever asks for it (the scaler page, the planner,
 * a Kitchen Brain tool): the live engine, or the built-in estimate with a
 * plain reason when the engine is unavailable. Throws only on programming
 * errors; an unavailable engine is a result, not an exception.
 */
export type ScaleJobResult = {
  sheet: ProductionSheet;
  demo: boolean;
  note?: string;
  ms: number;
  usage?: EngineUsage;
  engine?: string;
  knowledge?: string[];
  yieldsUsed?: string[];
};

/**
 * The built-in (no-AI) scaler. For the curated sample, the hand-tuned Mexican
 * Rice scaler; for ANY other recipe, the generic linear+dampening scaler on
 * the chef's own ingredients (so it never silently returns someone else's dish).
 */
export function demoSheetFor(input: ScaleInput): ProductionSheet {
  const text = (input.recipeText || "").trim();
  const isSample = text === SAMPLE.recipeText.trim();
  const sheet =
    text && !isSample
      ? demoScaleFromText(text, input.basePortions, input.targetCovers, input.portionSize, input.kitchenNotes.length, input.dish, input.yields)
      : demoScale(input.targetCovers, input.portionSize, input.kitchenNotes.length);
  sheet.source = "estimate";
  sheet.kitchenMemory = input.kitchenNotes;
  return plainSheet(sheet);
}

export async function runScale(input: ScaleInput): Promise<ScaleJobResult> {
  const t0 = Date.now();
  if (isDemoMode()) return { sheet: demoSheetFor(input), demo: true, ms: Date.now() - t0 };
  try {
    const { sheet, usage, knowledge, yieldsUsed } = await scaleRecipe(input);
    return { sheet, demo: false, ms: Date.now() - t0, usage, engine: ENGINE_VERSION, knowledge, yieldsUsed };
  } catch (e) {
    const reason = engineFailure(e);
    if (!reason) throw e;
    // Never leave the kitchen with an error: fall back to the built-in
    // scaler and say plainly why. The banner in the UI carries `note`.
    console.error("[scale] engine unavailable, built-in estimate served:", reason, "|", e instanceof Error ? e.message : e);
    const sheet = demoSheetFor(input);
    const note = `${reason} Showing the built-in estimate instead: a rough linear+dampening scale, not the chef-logic engine.`;
    sheet.assumptions = [`Live engine unavailable. ${note}`, ...sheet.assumptions];
    return { sheet, demo: true, note, ms: Date.now() - t0 };
  }
}
