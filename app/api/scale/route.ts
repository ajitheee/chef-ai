import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { friendlyEngineError } from "@/lib/engine/claude";
import { ScaleInputSchema } from "@/lib/engine/schema";
import { runScale } from "@/lib/engine/scale-job";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const input = ScaleInputSchema.parse(await req.json());
    const result = await runScale(input);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (!(e instanceof ZodError)) console.error("[scale] failed:", e);
    const message = friendlyEngineError(e, "Something went wrong scaling the recipe.");
    // Name the fields that failed so the form can highlight them.
    const fields = e instanceof ZodError ? e.issues.map((i) => String(i.path[0] ?? "")).filter(Boolean) : undefined;
    return NextResponse.json({ ok: false, error: message, fields }, { status: 400 });
  }
}
