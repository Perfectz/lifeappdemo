-- LifeQuest OS — member approval / access control
-- Applied to the lifequest-os project via the Supabase MCP (migrations
-- "app_member_approval" + "app_member_functions_harden"). Kept here for version
-- control / re-running in the SQL editor.
--
-- New members land as 'pending' and cannot use cloud features until the app
-- creator (pzgambo@gmail.com) approves them. RLS prevents self-approval; only
-- the creator can change status. Cloud data (user_data) is gated by approval.

create table if not exists public.app_members (
  user_id uuid primary key references auth.users on delete cascade,
  email text,
  status text not null default 'pending' check (status in ('pending','approved','denied')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid
);

alter table public.app_members enable row level security;

-- The single app creator/admin, identified by their verified auth email.
create or replace function public.is_app_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'email') = 'pzgambo@gmail.com', false);
$$;

-- True for the admin or any approved member.
create or replace function public.is_approved_member()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.is_app_admin() or exists (
    select 1 from public.app_members m
    where m.user_id = auth.uid() and m.status = 'approved'
  );
$$;

-- Members read their own row; the admin reads everyone's.
drop policy if exists "app_members read own or admin" on public.app_members;
create policy "app_members read own or admin" on public.app_members
  for select using (auth.uid() = user_id or public.is_app_admin());

-- A user may insert only their OWN row, and only as 'pending' (no self-approval).
drop policy if exists "app_members insert own pending" on public.app_members;
create policy "app_members insert own pending" on public.app_members
  for insert with check (
    public.is_app_admin() or (auth.uid() = user_id and status = 'pending')
  );

-- Only the admin can approve/deny or delete.
drop policy if exists "app_members admin update" on public.app_members;
create policy "app_members admin update" on public.app_members
  for update using (public.is_app_admin()) with check (public.is_app_admin());

drop policy if exists "app_members admin delete" on public.app_members;
create policy "app_members admin delete" on public.app_members
  for delete using (public.is_app_admin());

-- Seed the creator as approved.
insert into public.app_members (user_id, email, status, decided_at, decided_by)
select id, email, 'approved', now(), id from auth.users where email = 'pzgambo@gmail.com'
on conflict (user_id) do update set status = 'approved', decided_at = now();

-- Gate cloud sync data by approval (defense in depth beyond the client gate).
drop policy if exists "Users read own data" on public.user_data;
create policy "Users read own data" on public.user_data
  for select using (auth.uid() = user_id and public.is_approved_member());

drop policy if exists "Users insert own data" on public.user_data;
create policy "Users insert own data" on public.user_data
  for insert with check (auth.uid() = user_id and public.is_approved_member());

drop policy if exists "Users update own data" on public.user_data;
create policy "Users update own data" on public.user_data
  for update using (auth.uid() = user_id and public.is_approved_member())
  with check (auth.uid() = user_id and public.is_approved_member());
