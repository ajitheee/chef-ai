import { NextRequest, NextResponse } from "next/server";
import { scaleRecipe } from "@/lib/engine/claude";
import { ScaleInputSchema } from "@/lib/engine/schema";
import { isDemoMode, DEMO_SHEET } from "@/lib/engine/demo";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = ScaleInputSchema.parse(body);

    // No API key yet -> serve the pre-authored sample sheet so the full app
    // flow works end-to-end. Clearly flagged so the UI labels it as demo.
    if (isDemoMode()) {
      return NextResponse.json({ ok: true, sheet: DEMO_SHEET, demo: true });
    }

    const sheet = await scaleRecipe(input);
    return NextResponse.json({ ok: true, sheet, demo: false });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Something went wrong scaling the recipe.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
