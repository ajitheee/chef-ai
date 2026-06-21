import { NextRequest, NextResponse } from "next/server";
import { scaleRecipe } from "@/lib/engine/claude";
import { ScaleInputSchema } from "@/lib/engine/schema";
import { isDemoMode, demoScale } from "@/lib/engine/demo";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = ScaleInputSchema.parse(body);

    // No API key yet -> deterministically scale the sample recipe to the
    // requested cover count (responds to the target; shows dampening). Flagged
    // so the UI labels it as a demo preview.
    if (isDemoMode()) {
      return NextResponse.json({
        ok: true,
        sheet: demoScale(input.targetCovers, input.portionSize, input.kitchenNotes.length),
        demo: true,
      });
    }

    const sheet = await scaleRecipe(input);
    return NextResponse.json({ ok: true, sheet, demo: false });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Something went wrong scaling the recipe.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
