import { NextRequest, NextResponse } from "next/server";
import { suggestVariations } from "@/lib/engine/claude";
import { VariationsInputSchema } from "@/lib/engine/schema";
import { isDemoMode, demoVariations } from "@/lib/engine/demo";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = VariationsInputSchema.parse(body);

    if (isDemoMode()) {
      return NextResponse.json({ ok: true, result: demoVariations(), demo: true });
    }

    const result = await suggestVariations(input);
    return NextResponse.json({ ok: true, result, demo: false });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Something went wrong generating variations.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
