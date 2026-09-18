import { NextRequest, NextResponse } from "next/server";
import { GATE_COOKIE, gateToken } from "@/lib/gate";

export const runtime = "nodejs";

/** Check the shared pilot password and set the gate cookie. */
export async function POST(req: NextRequest) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return NextResponse.json({ ok: false, error: "The password gate isn't configured." }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { password?: string };
  if ((body.password ?? "") !== expected) {
    return NextResponse.json({ ok: false, error: "Wrong password." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(GATE_COOKIE, await gateToken(expected), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
