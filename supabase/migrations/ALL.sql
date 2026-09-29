-- Digital Chef AI — run this whole block once in the Supabase SQL editor (safe to re-run)

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

-- ============================================================
-- 0003_yields_versions_pause.sql
-- ============================================================
-- Digital Chef AI — 0003: verified yields, kitchen-memory pause, recipe versions + lifecycle.
-- Additive only (nothing renamed or dropped); safe to re-run. Run after 0001 and 0002.

-- 1. Kitchen memory: a correction can be paused without deleting it.
alter table public.kitchen_notes add column if not exists active boolean not null default true;

-- 2. Verified yields: the kitchen's own measured numbers. They outrank the
--    standard yield tables in every scale, and the sheet says "verified".
--    kind: trim = usable (EP) ÷ as-purchased (AP); cook = cooked ÷ raw.
--    yield_pct allows up to 400 so cook-up ratios (dry rice → cooked, ~300 %) fit.
create table if not exists public.yields (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product     text not null,
  kind        text not null check (kind in ('trim', 'cook')),
  yield_pct   numeric(6,2) not null check (yield_pct > 0 and yield_pct <= 400),
  source      text not null default '',
  verified_on date not null default current_date,
  created_at  timestamptz not null default now()
);
alter table public.yields enable row level security;
drop policy if exists "yields are private" on public.yields;
create policy "yields are private" on public.yields
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists yields_user_idx on public.yields(user_id, created_at desc);

-- 3. Recipe lifecycle (Master Prompt): Draft → Tested → Approved Master.
--    version counts up on every content change; the prior versions are kept (4).
alter table public.recipes add column if not exists status  text    not null default 'Draft';
alter table public.recipes add column if not exists version integer not null default 1;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'recipes_status_check') then
    alter table public.recipes
      add constraint recipes_status_check check (status in ('Draft', 'Tested', 'Approved Master'));
  end if;
end $$;

-- 4. Prior versions of a recipe, kept for history (status Superseded).
create table if not exists public.recipe_versions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  recipe_id     uuid not null references public.recipes(id) on delete cascade,
  version       integer not null,
  name          text not null,
  recipe_text   text not null,
  base_portions integer not null,
  portion_size  text not null,
  equipment     text,
  holding_time  text,
  tags          text[] not null default '{}',
  status        text not null default 'Superseded',
  saved_at      timestamptz not null,               -- when this version was last saved
  superseded_at timestamptz not null default now(), -- when it was replaced
  unique (recipe_id, version)
);
alter table public.recipe_versions enable row level security;
drop policy if exists "recipe_versions are private" on public.recipe_versions;
create policy "recipe_versions are private" on public.recipe_versions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists recipe_versions_recipe_idx on public.recipe_versions(recipe_id, version desc);

-- 5. Keep the prior version automatically on every content change, whatever
--    path made it (the scaler's Save, a restore, a future import). Updates that
--    only touch metadata (last covers, status) don't make a version. An edited
--    recipe goes back to Draft: it has to be tested again.
create or replace function public.recipes_keep_version() returns trigger
language plpgsql security invoker as $$
begin
  if (old.name, old.recipe_text, old.base_portions, old.portion_size,
      coalesce(old.equipment, ''), coalesce(old.holding_time, ''), old.tags)
     is distinct from
     (new.name, new.recipe_text, new.base_portions, new.portion_size,
      coalesce(new.equipment, ''), coalesce(new.holding_time, ''), new.tags) then
    insert into public.recipe_versions
      (user_id, recipe_id, version, name, recipe_text, base_portions, portion_size,
       equipment, holding_time, tags, saved_at)
    values
      (old.user_id, old.id, old.version, old.name, old.recipe_text, old.base_portions, old.portion_size,
       old.equipment, old.holding_time, old.tags, old.updated_at);
    new.version    := old.version + 1;
    new.status     := 'Draft';
    new.updated_at := now();
  end if;
  return new;
end
$$;
drop trigger if exists recipes_keep_version on public.recipes;
create trigger recipes_keep_version
  before update on public.recipes
  for each row execute function public.recipes_keep_version();

-- ============================================================
-- 0004_conversations_usage.sql
-- ============================================================
-- Digital Chef AI, 0004: saved Kitchen Brain conversations and a monthly AI budget.
-- Additive only (nothing renamed or dropped); safe to re-run. Run after 0001 to 0003.

-- 1. Conversations with Kitchen Brain.
create table if not exists public.conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title      text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.conversations enable row level security;
drop policy if exists "conversations are private" on public.conversations;
create policy "conversations are private" on public.conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists conversations_user_idx on public.conversations(user_id, updated_at desc);

-- 2. Messages. `parts` keeps what the chef saw, in order: text, tool calls, sheets.
--    client_id is the id the page gave the message, so a streamed answer can be
--    saved once it is complete (upsert on conversation_id + client_id).
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  client_id       text not null,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null default '',
  parts           jsonb not null default '[]'::jsonb,
  meta            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  unique (conversation_id, client_id)
);
alter table public.messages enable row level security;
drop policy if exists "messages are private" on public.messages;
create policy "messages are private" on public.messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists messages_conversation_idx on public.messages(conversation_id, created_at);

-- 3. AI usage, one row per engine call, so a kitchen's month can be summed,
--    priced and capped. A kitchen can read and add its own rows but never
--    change or delete them: the budget cannot be reset from the app.
create table if not exists public.usage_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('chat', 'scale', 'refine', 'variations')),
  tokens_in   integer not null default 0,
  tokens_out  integer not null default 0,
  cache_read  integer not null default 0,
  cache_write integer not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.usage_events enable row level security;
drop policy if exists "usage_events are private" on public.usage_events;
drop policy if exists "usage_events: own rows, read" on public.usage_events;
drop policy if exists "usage_events: own rows, add" on public.usage_events;
create policy "usage_events: own rows, read" on public.usage_events
  for select using (auth.uid() = user_id);
create policy "usage_events: own rows, add" on public.usage_events
  for insert with check (auth.uid() = user_id);
create index if not exists usage_events_user_month_idx on public.usage_events(user_id, created_at desc);
