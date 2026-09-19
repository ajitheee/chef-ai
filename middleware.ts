import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { GATE_COOKIE, gateToken } from "@/lib/gate";

/**
 * Access control, decided by the environment:
 *   - Supabase connected  -> real accounts; keeps the session cookie fresh and
 *                            sends signed-out visitors to /login (APIs get 401).
 *   - APP_PASSWORD set    -> shared pilot password (cookie holds a hash).
 *   - neither             -> open (local demo / mock mode).
 * The landing page, sign-in pages and static assets are always public.
 */

const PUBLIC = [/^\/$/, /^\/login/, /^\/gate/, /^\/auth\//, /^\/api\/gate$/, /^\/_next\//, /^\/favicon/, /\.(png|jpe?g|svg|ico|webp|css|js|txt|xml|woff2?)$/i];

function safeNext(path: string): string {
  return path.startsWith("/") && !path.startsWith("//") ? path : "/";
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && anon && path !== "/auth/callback") {
    // Supabase sends every email link (magic link, confirmation, password
    // reset) to the project's Site URL with a one-time ?code=. Finish the
    // sign-in wherever that lands instead of leaving the visitor logged out.
    const code = req.nextUrl.searchParams.get("code");
    if (code) {
      const cb = req.nextUrl.clone();
      cb.pathname = "/auth/callback";
      cb.search = `?code=${encodeURIComponent(code)}&next=${encodeURIComponent(safeNext(path === "/" ? "/library" : path))}`;
      return NextResponse.redirect(cb);
    }
    // Expired / already-used links arrive as ?error_description=... — show it on the login page.
    const desc = req.nextUrl.searchParams.get("error_description");
    if (desc && path !== "/login") {
      const login = req.nextUrl.clone();
      login.pathname = "/login";
      login.search = `?error=${encodeURIComponent(desc)}`;
      return NextResponse.redirect(login);
    }
  }

  if (PUBLIC.some((re) => re.test(path))) return NextResponse.next();

  if (url && anon) {
    let res = NextResponse.next({ request: req });
    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      if (path.startsWith("/api/")) {
        return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
      }
      const login = req.nextUrl.clone();
      login.pathname = "/login";
      login.search = `?next=${encodeURIComponent(safeNext(path))}`;
      return NextResponse.redirect(login);
    }
    return res;
  }

  const gate = process.env.APP_PASSWORD;
  if (gate) {
    const ok = req.cookies.get(GATE_COOKIE)?.value === (await gateToken(gate));
    if (!ok) {
      if (path.startsWith("/api/")) {
        return NextResponse.json({ ok: false, error: "Password required." }, { status: 401 });
      }
      const g = req.nextUrl.clone();
      g.pathname = "/gate";
      g.search = `?next=${encodeURIComponent(safeNext(path))}`;
      return NextResponse.redirect(g);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
