import { NextRequest, NextResponse } from "next/server";
import { scaleRecipe, engineFailure, friendlyEngineError } from "@/lib/engine/claude";
import { ScaleInputSchema, type ScaleInput, type ProductionSheet } from "@/lib/engine/schema";
import { isDemoMode, demoScale, demoScaleFromText } from "@/lib/engine/demo";
import { SAMPLE } from "@/lib/engine/sample";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * The built-in (no-AI) scaler. For the curated sample, the hand-tuned Mexican
 * Rice scaler; for ANY other recipe, the generic linear+dampening scaler on
 * the chef's own ingredients (so it never silently returns someone else's dish).
 */
function demoSheetFor(input: ScaleInput): ProductionSheet {
  const text = (input.recipeText || "").trim();
  const isSample = text === SAMPLE.recipeText.trim();
  return text && !isSample
    ? demoScaleFromText(text, input.basePortions, input.targetCovers, input.portionSize, input.kitchenNotes.length, input.dish)
    : demoScale(input.targetCovers, input.portionSize, input.kitchenNotes.length);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = ScaleInputSchema.parse(body);

    if (isDemoMode()) {
      return NextResponse.json({ ok: true, sheet: demoSheetFor(input), demo: true });
    }

    const t0 = Date.now();
    try {
      const { sheet, usage } = await scaleRecipe(input);
      return NextResponse.json({ ok: true, sheet, demo: false, ms: Date.now() - t0, usage });
    } catch (e) {
      const reason = engineFailure(e);
      if (!reason) throw e;
      // Never leave the kitchen with an error: fall back to the built-in
      // scaler and say plainly why. The banner in the UI carries `note`.
      const sheet = demoSheetFor(input);
      const note = `${reason} Showing the built-in estimate instead — a rough linear+dampening scale, not the chef-logic engine.`;
      sheet.assumptions = [`LIVE ENGINE UNAVAILABLE — ${note}`, ...sheet.assumptions];
      return NextResponse.json({ ok: true, sheet, demo: true, note });
    }
  } catch (e) {
    const message = friendlyEngineError(e, "Something went wrong scaling the recipe.");
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
