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
