# Going live (Vercel) — 15 minutes

Two ways to run it live. Pick the one that matches where you are.

## A · Pilot behind a password (no database) — fastest
Good for the first chef: everything works, data stays in his browser (plus
Backup/Restore), and nobody else can open the URL.

1. [vercel.com](https://vercel.com) → **Add New → Project** → import `ajitheee/chef-ai`.
   Framework is auto-detected (Next.js). Leave build settings as they are.
2. **Environment Variables** — add:
   - `ANTHROPIC_API_KEY` = your key (leave it out to stay in demo mode)
   - `APP_PASSWORD` = the kitchen password you'll give the chef
3. **Deploy.** Open the URL → `/gate` asks for the password once per device (30 days).

In this mode the **library is the 50 starter recipes** (read-only in practice:
a recipe added via "+ New recipe" lives in server memory and won't survive a
restart). The chef's own recipes still save per device inside the scaler
("Save recipe" + Backup/Restore). Want them in the cloud? That's option B.

## B · Real accounts + cloud database (Supabase)
Recipes live in the cloud under the chef's login: multi-device, survives cache
clears, one login per chef.

1. Do `supabase/SETUP.md` (create the project, run **both** migrations
   `0001_init.sql` and `0002_recipes_slug.sql` in the SQL editor, copy the keys).
2. Create the chef's login: Supabase → **Authentication → Users → Add user**
   (email + password). Or turn on sign-ups if you'd rather he self-registers.
3. Vercel → Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ANTHROPIC_API_KEY`
   - (remove `APP_PASSWORD` — real login replaces it)
4. Supabase → **Authentication → URL Configuration**: set *Site URL* to your
   Vercel URL and add `https://<your-app>.vercel.app/auth/callback` to the
   redirect list (needed for the emailed sign-in link).
5. **Redeploy.** Open the URL → `/login` → sign in → `/library` is empty →
   **Import the 50 starter recipes** (one click) or **+ New recipe**.

## How access is decided (middleware)
| Environment | Who can open `/app`, `/library`, the APIs |
|---|---|
| Supabase keys set | signed-in users only (APIs return 401 otherwise) |
| only `APP_PASSWORD` set | anyone with the password (cookie, 30 days) |
| neither | open — local demo / mock mode |

The landing page `/` is always public. Never set the Supabase **service_role**
key anywhere in this app — it isn't needed and would bypass row-level security.

## Before every deploy
```bash
npm run sweep && npm run referee && npm run brain:check
```
Runs all 54 recipes (the chef's presets + the test library) through the whole
deterministic pipeline — scaler, accuracy referee, purchasing, nutrition,
HACCP, prep list, SOP — and fails on anything that throws or breaks the schema.
`npm run sweep -- --only=tomato --dump` shows one recipe in full.

## After it's live
- Local dev keeps working as before: `npm run dev` with your `.env.local`.
- Every push to `main` redeploys automatically.
- With Supabase connected, everything the chef touches — library, saved
  recipes, kitchen memory, price book, sheet history — lives in his rows and
  follows his login to any device. Without it, the same screens save per
  device in the browser (Backup/Restore moves them).

## Custom domain

The app never hard-codes its host (sign-in links use the page's own origin), so a
domain is three settings and no code:

1. **Vercel → project → Settings → Domains → Add.** Easiest: buy the name right
   there — Vercel registers it and sets the DNS itself. If the name lives at
   another registrar, add the records Vercel shows: apex `A 76.76.21.21`, and
   `www` → `CNAME cname.vercel-dns.com`. Add both `yourdomain.com` and
   `www.yourdomain.com`; Vercel redirects one to the other.
2. **Supabase → Authentication → URL Configuration.** Site URL =
   `https://yourdomain.com`; Redirect URLs: add `https://yourdomain.com/**`.
   Keep the old `.vercel.app` entries until everyone has switched.
3. **Check.** `https://yourdomain.com/api/health` → `"ok": true`; sign out and in
   once (the emailed links now point at the new domain); print one sheet — the
   footer's Terms link should open `https://yourdomain.com/terms`.

The `.vercel.app` address keeps working alongside the domain.
