-- Digital Chef AI — initial schema
-- Per-user recipe library, kitchen memory, price book, and sheet history.
-- Every table is row-level-secured to the owning auth user, so one chef never
-- sees another's data. Run this once in the Supabase SQL editor (see SETUP.md).

create extension if not exists "pgcrypto";

-- Recipes: the chef's standardized recipe library.
create table if not exists public.recipes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name          text not null,
  recipe_text   text not null,
  base_portions integer not null,
  portion_size  text not null,
  equipment     text,
  holding_time  text,
  last_covers   integer,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Kitchen memory: the learning loop (his corrections about HIS kitchen).
create table if not exists public.kitchen_notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text       text not null,
  created_at timestamptz not null default now()
);

-- Price book: unit-aware costing inputs.
create table if not exists public.prices (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  unit       text not null,
  price      numeric(12,4) not null,
  created_at timestamptz not null default now()
);

-- Production-sheet history: an audit trail of every scaled sheet.
create table if not exists public.sheets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  dish       text not null,
  covers     integer not null,
  sheet      jsonb not null,
  created_at timestamptz not null default now()
);

-- Row-level security: a user reads and writes only their own rows.
alter table public.recipes      enable row level security;
alter table public.kitchen_notes enable row level security;
alter table public.prices       enable row level security;
alter table public.sheets       enable row level security;

-- Drop-and-recreate policies so this file is safe to re-run.
drop policy if exists "recipes are private"      on public.recipes;
drop policy if exists "kitchen_notes are private" on public.kitchen_notes;
drop policy if exists "prices are private"       on public.prices;
drop policy if exists "sheets are private"       on public.sheets;

create policy "recipes are private" on public.recipes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "kitchen_notes are private" on public.kitchen_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "prices are private" on public.prices
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sheets are private" on public.sheets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Indexes for the common "my rows, newest first" reads.
create index if not exists recipes_user_idx       on public.recipes(user_id, created_at desc);
create index if not exists kitchen_notes_user_idx  on public.kitchen_notes(user_id, created_at desc);
create index if not exists prices_user_idx         on public.prices(user_id, created_at desc);
create index if not exists sheets_user_idx         on public.sheets(user_id, created_at desc);
