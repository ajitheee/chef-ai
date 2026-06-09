import { NextRequest, NextResponse } from "next/server";
import { scaleRecipe } from "@/lib/engine/claude";
import { ScaleInputSchema } from "@/lib/engine/schema";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = ScaleInputSchema.parse(body);
    const sheet = await scaleRecipe(input);
    return NextResponse.json({ ok: true, sheet });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Something went wrong scaling the recipe.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
