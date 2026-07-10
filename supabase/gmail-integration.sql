-- LifeQuest Gmail connector credentials.
-- Server-only: the browser roles receive no table privileges and there are no
-- RLS policies. Access is exclusively through authenticated Next.js routes
-- using the service role after requireUser verifies the caller.

create table if not exists public.gmail_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  refresh_token_ciphertext text not null,
  scopes text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gmail_connections enable row level security;
revoke all on table public.gmail_connections from anon, authenticated;

comment on table public.gmail_connections is
  'Server-only encrypted Google OAuth refresh tokens for the LifeQuest Gmail connector.';
