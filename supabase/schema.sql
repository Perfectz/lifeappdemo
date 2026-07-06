-- LifeQuest OS — cloud sync schema
-- Run this once in the Supabase dashboard: SQL Editor → New query → paste → Run.
--
-- One row per user holds a full JSON snapshot of their local data. Row Level
-- Security ensures each signed-in user can only read/write their own row, so
-- the public anon key is safe to ship in the browser.

create table if not exists public.user_data (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

drop policy if exists "Users read own data" on public.user_data;
create policy "Users read own data"
  on public.user_data for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own data" on public.user_data;
create policy "Users insert own data"
  on public.user_data for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own data" on public.user_data;
create policy "Users update own data"
  on public.user_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Server-authoritative updated_at: the sync client uses this column as an
-- optimistic-concurrency token (UPDATE … WHERE updated_at = <last seen>),
-- so it must come from the database clock, never a device clock. The trigger
-- overrides any client-sent value on insert and update.
create or replace function public.set_user_data_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_data_set_updated_at on public.user_data;
create trigger user_data_set_updated_at
  before insert or update on public.user_data
  for each row
  execute function public.set_user_data_updated_at();
