-- Digital Chef AI — recipes get a stable URL slug + tags (Slice 7).
-- Safe to re-run.

alter table public.recipes add column if not exists slug text;
alter table public.recipes add column if not exists tags text[] not null default '{}';

-- Backfill any rows created before slugs existed.
update public.recipes
   set slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
 where slug is null;

alter table public.recipes alter column slug set not null;

-- One slug per user (the app appends -2, -3... on collisions).
create unique index if not exists recipes_user_slug_idx on public.recipes(user_id, slug);
