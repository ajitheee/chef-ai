import { NextRequest, NextResponse } from "next/server";
import { scaleRecipe } from "@/lib/engine/claude";
import { ScaleInputSchema } from "@/lib/engine/schema";
import { isDemoMode, demoScale, demoScaleFromText } from "@/lib/engine/demo";
import { SAMPLE } from "@/lib/engine/sample";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = ScaleInputSchema.parse(body);

    // No API key yet -> demo preview. For the curated sample, use the hand-tuned
    // Mexican Rice scaler; for ANY other pasted recipe, run a generic
    // linear+dampening scaler on the chef's OWN ingredients (so it never
    // silently returns someone else's dish). Flagged so the UI labels it demo.
    if (isDemoMode()) {
      const text = (input.recipeText || "").trim();
      const isSample = text === SAMPLE.recipeText.trim();
      const sheet =
        text && !isSample
          ? demoScaleFromText(text, input.basePortions, input.targetCovers, input.portionSize, input.kitchenNotes.length)
          : demoScale(input.targetCovers, input.portionSize, input.kitchenNotes.length);
      return NextResponse.json({ ok: true, sheet, demo: true });
    }

    const sheet = await scaleRecipe(input);
    return NextResponse.json({ ok: true, sheet, demo: false });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Something went wrong scaling the recipe.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
