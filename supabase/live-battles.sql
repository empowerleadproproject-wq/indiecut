create extension if not exists pgcrypto;

create table if not exists public.battle_contests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  status text not null default 'draft' check (status in ('draft','qualifying','scheduled','live','completed')),
  qualifying_starts_at timestamptz,
  qualifying_ends_at timestamptz,
  live_starts_at timestamptz,
  vote_window_seconds integer not null default 30 check (vote_window_seconds between 10 and 300),
  current_segment text not null default 'lobby' check (current_segment in ('lobby','artist_a','artist_b','voting','results','commercial','complete')),
  segment_started_at timestamptz,
  zoom_session_name text,
  zoom_session_passcode text,
  host_code text not null default encode(gen_random_bytes(16),'hex'),
  sponsor_name text,
  sponsor_logo_url text,
  sponsor_destination_url text,
  commercial_url text,
  current_round_id uuid,
  winner_entry_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.battle_entries (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.battle_contests(id) on delete cascade,
  artist_id uuid references public.artists(id) on delete set null,
  artist_name text not null,
  slug text not null,
  genre text,
  city text,
  bio text,
  image_url text,
  track_title text,
  track_url text,
  track_cover_url text,
  instagram_url text,
  tiktok_url text,
  youtube_url text,
  facebook_url text,
  studio_code text not null default encode(gen_random_bytes(16),'hex'),
  seed integer,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(contest_id,slug)
);

alter table public.battle_entries add column if not exists instagram_url text;
alter table public.battle_entries add column if not exists tiktok_url text;
alter table public.battle_entries add column if not exists youtube_url text;
alter table public.battle_entries add column if not exists facebook_url text;

create table if not exists public.battle_rounds (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.battle_contests(id) on delete cascade,
  round_number integer not null,
  title text,
  entry_a_id uuid not null references public.battle_entries(id) on delete cascade,
  entry_b_id uuid not null references public.battle_entries(id) on delete cascade,
  track_a_title text,
  track_a_url text,
  track_b_title text,
  track_b_url text,
  status text not null default 'pending' check (status in ('pending','artist_a','artist_b','voting','closed')),
  vote_opens_at timestamptz,
  vote_closes_at timestamptz,
  winner_entry_id uuid references public.battle_entries(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(contest_id,round_number)
);

alter table public.battle_contests
  drop constraint if exists battle_contests_current_round_id_fkey;
alter table public.battle_contests
  add constraint battle_contests_current_round_id_fkey foreign key(current_round_id) references public.battle_rounds(id) on delete set null;
alter table public.battle_contests
  drop constraint if exists battle_contests_winner_entry_id_fkey;
alter table public.battle_contests
  add constraint battle_contests_winner_entry_id_fkey foreign key(winner_entry_id) references public.battle_entries(id) on delete set null;

create table if not exists public.battle_votes (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.battle_contests(id) on delete cascade,
  entry_id uuid not null references public.battle_entries(id) on delete cascade,
  round_id uuid references public.battle_rounds(id) on delete cascade,
  vote_scope text not null,
  ip_hash text not null,
  device_hash text not null,
  user_agent_hash text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists battle_votes_one_network_per_scope
  on public.battle_votes(contest_id,vote_scope,ip_hash);
create unique index if not exists battle_votes_one_device_per_scope
  on public.battle_votes(contest_id,vote_scope,device_hash);
create index if not exists battle_votes_entry_idx on public.battle_votes(entry_id);
create index if not exists battle_votes_round_idx on public.battle_votes(round_id);
create index if not exists battle_entries_contest_idx on public.battle_entries(contest_id);
create index if not exists battle_rounds_contest_idx on public.battle_rounds(contest_id,round_number);

alter table public.battle_contests enable row level security;
alter table public.battle_entries enable row level security;
alter table public.battle_rounds enable row level security;
alter table public.battle_votes enable row level security;

-- These tables contain private studio access codes and vote-fraud hashes. They intentionally
-- have no anon/authenticated policies. All public battle data is served through server routes,
-- which strip studio codes/passcodes before returning it to browsers.
drop policy if exists "public read battle contests" on public.battle_contests;
drop policy if exists "public read battle entries" on public.battle_entries;
drop policy if exists "public read battle rounds" on public.battle_rounds;
