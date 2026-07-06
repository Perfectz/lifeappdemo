-- LifeQuest OS — server-authoritative updated_at for cloud sync
-- Run this once in the Supabase dashboard: SQL Editor → New query → paste → Run.
--
-- Why: the sync client uses updated_at as an optimistic-concurrency token
-- (UPDATE … WHERE updated_at = <last seen value>). For that to be trustworthy
-- it must come from the database clock, never from a device clock — a skewed
-- device would otherwise invert newer/older ordering and could discard newer
-- edits. This trigger stamps every insert/update with now(), overriding
-- whatever value a client sends, and clients read the result back after each
-- write.

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
