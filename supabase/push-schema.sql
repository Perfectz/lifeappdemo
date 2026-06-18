-- LifeQuest OS — push notification subscriptions
-- One row per device subscription. Users manage their own (RLS); the cron job
-- reads all of them via the service-role key. Apply once in the SQL editor.

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users on delete cascade,
  subscription jsonb not null,
  timezone text,
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "own subs select" on public.push_subscriptions;
create policy "own subs select" on public.push_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "own subs insert" on public.push_subscriptions;
create policy "own subs insert" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists "own subs update" on public.push_subscriptions;
create policy "own subs update" on public.push_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own subs delete" on public.push_subscriptions;
create policy "own subs delete" on public.push_subscriptions
  for delete using (auth.uid() = user_id);
