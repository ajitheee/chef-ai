import { NextResponse } from "next/server";
import { usageDb, monthUsage } from "@/lib/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** This kitchen's AI spend this month, priced at the configured rates, against its budget. */
export async function GET() {
  try {
    const u = await monthUsage(await usageDb());
    return NextResponse.json({ ok: true, ...u });
  } catch (e) {
    console.error("[usage] failed:", e);
    return NextResponse.json({ ok: false, error: "Usage could not be read just now." }, { status: 500 });
  }
}
