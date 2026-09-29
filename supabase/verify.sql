-- Digital Chef AI: verify every object that migrations 0001 to 0004 create.
-- Paste into the Supabase SQL editor and Run. Every row should read "found".
-- A "MISSING" row names the migration to re-run (they are all safe to re-run).

with expected(kind, name, migration) as (
  values
    -- 0001
    ('table', 'recipes', '0001'), ('table', 'kitchen_notes', '0001'), ('table', 'prices', '0001'), ('table', 'sheets', '0001'),
    ('rls', 'recipes', '0001'), ('rls', 'kitchen_notes', '0001'), ('rls', 'prices', '0001'), ('rls', 'sheets', '0001'),
    ('policy', 'recipes are private', '0001'), ('policy', 'kitchen_notes are private', '0001'),
    ('policy', 'prices are private', '0001'), ('policy', 'sheets are private', '0001'),
    ('index', 'recipes_user_idx', '0001'), ('index', 'kitchen_notes_user_idx', '0001'),
    ('index', 'prices_user_idx', '0001'), ('index', 'sheets_user_idx', '0001'),
    -- 0002
    ('column', 'recipes.slug', '0002'), ('column', 'recipes.tags', '0002'), ('index', 'recipes_user_slug_idx', '0002'),
    -- 0003
    ('column', 'kitchen_notes.active', '0003'),
    ('table', 'yields', '0003'), ('rls', 'yields', '0003'), ('policy', 'yields are private', '0003'), ('index', 'yields_user_idx', '0003'),
    ('column', 'recipes.status', '0003'), ('column', 'recipes.version', '0003'), ('constraint', 'recipes_status_check', '0003'),
    ('table', 'recipe_versions', '0003'), ('rls', 'recipe_versions', '0003'), ('policy', 'recipe_versions are private', '0003'),
    ('index', 'recipe_versions_recipe_idx', '0003'),
    ('function', 'recipes_keep_version', '0003'), ('trigger', 'recipes_keep_version', '0003'),
    -- 0004
    ('table', 'conversations', '0004'), ('rls', 'conversations', '0004'), ('policy', 'conversations are private', '0004'),
    ('index', 'conversations_user_idx', '0004'),
    ('table', 'messages', '0004'), ('rls', 'messages', '0004'), ('policy', 'messages are private', '0004'),
    ('index', 'messages_conversation_idx', '0004'), ('column', 'messages.parts', '0004'), ('column', 'messages.client_id', '0004'),
    ('table', 'usage_events', '0004'), ('rls', 'usage_events', '0004'),
    ('policy', 'usage_events: own rows, read', '0004'), ('policy', 'usage_events: own rows, add', '0004'),
    ('index', 'usage_events_user_month_idx', '0004')
),
found(kind, name) as (
  select 'table', table_name from information_schema.tables where table_schema = 'public'
  union all select 'column', table_name || '.' || column_name from information_schema.columns where table_schema = 'public'
  union all select 'policy', policyname from pg_policies where schemaname = 'public'
  union all select 'index', indexname from pg_indexes where schemaname = 'public'
  union all select 'trigger', t.tgname from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and not t.tgisinternal
  union all select 'function', p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
  union all select 'constraint', con.conname from pg_constraint con join pg_namespace n on n.oid = con.connamespace where n.nspname = 'public'
  union all select 'rls', c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
)
select
  case when f.name is null then 'MISSING' else 'found' end as status,
  e.migration,
  e.kind,
  e.name
from expected e
left join found f on f.kind = e.kind and f.name = e.name
order by (f.name is null) desc, e.migration, e.kind, e.name;
