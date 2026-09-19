import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeNext(v: string | null): string {
  return v && v.startsWith("/") && !v.startsWith("//") ? v : "/library";
}

/**
 * Turns the one-time ?code= from a Supabase email link (magic link, account
 * confirmation, password reset) into a session cookie, then continues to
 * `next`. The middleware routes codes here from wherever the link landed.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  const desc = searchParams.get("error_description");

  if (desc) return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(desc)}`);

  if (code) {
    const supabase = await createClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(`${origin}${next}`);
      const msg = /verifier/i.test(error.message)
        ? "Open the email link in the same browser you used to request it, then try again."
        : error.message;
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(msg)}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("That sign-in link didn't work — request a new one.")}`);
}
