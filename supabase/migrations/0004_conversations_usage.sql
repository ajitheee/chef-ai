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
