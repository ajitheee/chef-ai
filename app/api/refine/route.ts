import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { refineSheet, engineFailure, friendlyEngineError } from "@/lib/engine/claude";
import { ProductionSheetSchema } from "@/lib/engine/schema";
import { isDemoMode } from "@/lib/engine/demo";

export const runtime = "nodejs";
export const maxDuration = 300;

const RefineRequestSchema = z.object({
  sheet: ProductionSheetSchema,
  instruction: z.string().min(1, "Tell the engine what to change."),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sheet, instruction } = RefineRequestSchema.parse(body);

    if (isDemoMode()) {
      // Refinement requires the live engine — return the sheet unchanged with
      // a clear demo note so the UI can explain.
      return NextResponse.json({
        ok: true,
        sheet,
        demo: true,
        note: "Demo mode: refinement runs on the live engine. Add the API key to enable it.",
      });
    }

    try {
      const updated = await refineSheet(sheet, instruction);
      return NextResponse.json({ ok: true, sheet: updated, demo: false });
    } catch (e) {
      const reason = engineFailure(e);
      if (!reason) throw e;
      console.error("[refine] engine unavailable:", reason, "—", e instanceof Error ? e.message : e);
      return NextResponse.json({ ok: true, sheet, demo: true, note: `${reason} The sheet is unchanged — try again once it's back.` });
    }
  } catch (e) {
    if (!(e instanceof z.ZodError)) console.error("[refine] failed:", e);
    const message = friendlyEngineError(e, "Something went wrong refining the sheet.");
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
