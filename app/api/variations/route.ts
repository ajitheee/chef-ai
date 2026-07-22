import { NextRequest, NextResponse } from "next/server";
import { suggestVariations } from "@/lib/engine/claude";
import { VariationsInputSchema } from "@/lib/engine/schema";
import { isDemoMode, demoVariations } from "@/lib/engine/demo";
import { SAMPLE } from "@/lib/engine/sample";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = VariationsInputSchema.parse(body);

    if (isDemoMode()) {
      // Only the curated sample has pre-authored variations. For any other
      // dish, don't hand back Mexican-Rice variations — say the live engine is
      // needed (variations are genuinely generative, unlike deterministic scaling).
      const text = (input.recipeText || "").trim();
      const isSample = text === SAMPLE.recipeText.trim() || /mexican rice/i.test(input.dish || "");
      if (isSample) {
        return NextResponse.json({ ok: true, result: demoVariations(), demo: true });
      }
      return NextResponse.json({
        ok: true,
        result: { dish: input.dish || "Your recipe", variations: [] },
        demo: true,
        note: `Variations for "${input.dish || "this recipe"}" need the live engine — add the API key to generate fresh versions.`,
      });
    }

    const result = await suggestVariations(input);
    return NextResponse.json({ ok: true, result, demo: false });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Something went wrong generating variations.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
