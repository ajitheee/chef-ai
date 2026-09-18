# Connecting Supabase (optional — 3 minutes)

The app works **without** this — it stores recipes, kitchen memory, prices, and
sheet history in the browser (localStorage), and you can Backup/Restore to a
file from the toolbar. Connect Supabase when you want data to live in the cloud:
survive a cleared cache, sync across devices, and back one login per chef.

## Steps

1. **Create a project** — go to [supabase.com](https://supabase.com), sign in,
   **New project**. Pick a name and a strong database password. Free tier is
   fine ($0, plenty for a pilot). Wait ~2 min for it to spin up.

2. **Run the schema** — in the project, open **SQL Editor → New query**, paste
   the entire contents of [`migrations/0001_init.sql`](migrations/0001_init.sql),
   click **Run**, then do the same with
   [`migrations/0002_recipes_slug.sql`](migrations/0002_recipes_slug.sql).
   This creates the tables and locks each one to its owner with row-level
   security.

3. **Copy your keys** — **Settings → API**. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

4. **Paste them in** — in `.env.local` (copy from `.env.local.example` if you
   haven't), fill both values. Restart `npm run dev`.

That's it. `isSupabaseConfigured()` flips to true and the data layer can read and
write Supabase. The `anon` key is safe in the browser — row-level security is
what protects the data, and it's already on every table.

## Notes

- **Free projects pause after ~7 days of no activity.** If the dashboard looks
  "closed," it's just paused — open the project and hit **Restore/Resume**.
- **Auth** (one login per chef) is wired: `/login` takes email + password or an
  emailed sign-in link. Create the chef's user under **Authentication → Users →
  Add user**, and add `<your-url>/auth/callback` to **Authentication → URL
  Configuration** redirect URLs so the emailed link works. Recipes in `/library`
  read and write his rows; the first visit offers a one-click import of the 50
  starter recipes.
- Keep `.env.local` out of git (it already is via `.gitignore`). Never commit
  the **service_role** key — you don't need it for this app.
