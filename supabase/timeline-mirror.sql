-- LifeQuest OS — Timeline Mirror schema
-- Applied to the lifequest-os project via the Supabase MCP (migration
-- "timeline_mirror"). Kept here for version control / re-running in the SQL
-- editor: SQL Editor → New query → paste → Run.
--
-- Hybrid privacy model: the sensitive image bytes stay on-device (IndexedDB);
-- these tables store metadata, scores, history, and the markdown rubrics so the
-- user gets cloud history + trends without their physique photos leaving the
-- device. The image_url columns exist for an optional future cloud-bucket mode
-- but are nullable and unused in the default build. RLS mirrors user_data:
-- each signed-in user can only touch their own rows.

-- ---------------------------------------------------------------- references
create table if not exists public.timeline_reference_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('baseline','ideal','warning')),
  pose_type text not null default 'unknown'
    check (pose_type in ('front_full_body','right_side_full_body','face_upper_45','unknown')),
  image_local_id text,            -- key into the on-device image store
  image_url text,                 -- optional cloud-bucket mode only
  thumbnail_url text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.timeline_reference_images enable row level security;

drop policy if exists "ref images select own" on public.timeline_reference_images;
create policy "ref images select own" on public.timeline_reference_images
  for select using (auth.uid() = user_id);
drop policy if exists "ref images insert own" on public.timeline_reference_images;
create policy "ref images insert own" on public.timeline_reference_images
  for insert with check (auth.uid() = user_id);
drop policy if exists "ref images update own" on public.timeline_reference_images;
create policy "ref images update own" on public.timeline_reference_images
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "ref images delete own" on public.timeline_reference_images;
create policy "ref images delete own" on public.timeline_reference_images
  for delete using (auth.uid() = user_id);

create index if not exists timeline_reference_images_user_idx
  on public.timeline_reference_images (user_id, role);

-- ----------------------------------------------------------------- check-ins
create table if not exists public.timeline_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  check_date date not null,
  image_local_id text,
  image_url text,
  thumbnail_url text,
  detected_pose_type text not null default 'unknown',
  timeline_score int not null default 50,
  ideal_percent int not null default 50,
  warning_percent int not null default 50,
  direction text not null default 'unclear',
  backslide_detected boolean not null default false,
  confidence text not null default 'medium',
  visual_summary text,
  data_summary text,
  overall_read text,
  positive_signal text,
  warning_signal text,
  next_quest_json jsonb,
  jrpg_message text,
  coach_note text,
  raw_ai_response_json jsonb,
  created_at timestamptz not null default now()
);

alter table public.timeline_checkins enable row level security;

drop policy if exists "checkins select own" on public.timeline_checkins;
create policy "checkins select own" on public.timeline_checkins
  for select using (auth.uid() = user_id);
drop policy if exists "checkins insert own" on public.timeline_checkins;
create policy "checkins insert own" on public.timeline_checkins
  for insert with check (auth.uid() = user_id);
drop policy if exists "checkins update own" on public.timeline_checkins;
create policy "checkins update own" on public.timeline_checkins
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "checkins delete own" on public.timeline_checkins;
create policy "checkins delete own" on public.timeline_checkins
  for delete using (auth.uid() = user_id);

create index if not exists timeline_checkins_user_date_idx
  on public.timeline_checkins (user_id, check_date desc);

-- ------------------------------------------------------------- identity docs
create table if not exists public.timeline_identity_docs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  doc_type text not null check (doc_type in ('ideal_version','warning_version')),
  title text not null default '',
  markdown_content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, doc_type)
);

alter table public.timeline_identity_docs enable row level security;

drop policy if exists "identity docs select own" on public.timeline_identity_docs;
create policy "identity docs select own" on public.timeline_identity_docs
  for select using (auth.uid() = user_id);
drop policy if exists "identity docs insert own" on public.timeline_identity_docs;
create policy "identity docs insert own" on public.timeline_identity_docs
  for insert with check (auth.uid() = user_id);
drop policy if exists "identity docs update own" on public.timeline_identity_docs;
create policy "identity docs update own" on public.timeline_identity_docs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "identity docs delete own" on public.timeline_identity_docs;
create policy "identity docs delete own" on public.timeline_identity_docs
  for delete using (auth.uid() = user_id);
