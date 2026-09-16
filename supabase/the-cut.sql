-- The Cut: isolated live-audio social layer for Indie Cut.
-- Safe to run independently of the existing content, battle, CRM and rewards tables.

create extension if not exists pgcrypto;

create table if not exists public.cut_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  headline text,
  industry_role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cut_rooms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  category text not null default 'Open Networking',
  host_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'live' check (status in ('scheduled','live','ended','cancelled')),
  scheduled_for timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  peak_listeners integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cut_room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.cut_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'listener' check (role in ('host','cohost','speaker','listener')),
  request_status text not null default 'none' check (request_status in ('none','requested','approved','rejected')),
  livekit_identity text not null,
  requested_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(room_id,user_id),
  unique(room_id,livekit_identity)
);

create table if not exists public.cut_listener_sessions (
  id uuid primary key,
  room_id uuid not null references public.cut_rooms(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  participant_identity text not null,
  is_guest boolean not null default true,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  left_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists cut_rooms_status_idx on public.cut_rooms(status,created_at desc);
create index if not exists cut_rooms_host_idx on public.cut_rooms(host_id,created_at desc);
create index if not exists cut_room_members_room_idx on public.cut_room_members(room_id,request_status,created_at);
create index if not exists cut_listener_sessions_room_idx on public.cut_listener_sessions(room_id,last_seen_at desc);

alter table public.cut_profiles enable row level security;
alter table public.cut_rooms enable row level security;
alter table public.cut_room_members enable row level security;
alter table public.cut_listener_sessions enable row level security;

drop policy if exists "cut profiles are public" on public.cut_profiles;
create policy "cut profiles are public" on public.cut_profiles for select using (true);
drop policy if exists "users create own cut profile" on public.cut_profiles;
create policy "users create own cut profile" on public.cut_profiles for insert with check (auth.uid()=id);
drop policy if exists "users update own cut profile" on public.cut_profiles;
create policy "users update own cut profile" on public.cut_profiles for update using (auth.uid()=id) with check (auth.uid()=id);

drop policy if exists "public can see cut rooms" on public.cut_rooms;
create policy "public can see cut rooms" on public.cut_rooms for select using (status in ('scheduled','live','ended'));
drop policy if exists "hosts create cut rooms" on public.cut_rooms;
create policy "hosts create cut rooms" on public.cut_rooms for insert with check (auth.uid()=host_id);
drop policy if exists "hosts update cut rooms" on public.cut_rooms;
create policy "hosts update cut rooms" on public.cut_rooms for update using (auth.uid()=host_id) with check (auth.uid()=host_id);

drop policy if exists "users see own cut membership" on public.cut_room_members;
create policy "users see own cut membership" on public.cut_room_members for select using (auth.uid()=user_id);
drop policy if exists "users request cut membership" on public.cut_room_members;
create policy "users request cut membership" on public.cut_room_members for insert with check (auth.uid()=user_id);
drop policy if exists "users update own cut request" on public.cut_room_members;
create policy "users update own cut request" on public.cut_room_members for update using (auth.uid()=user_id) with check (auth.uid()=user_id);

-- Public avatar bucket. Writes are performed by the authenticated The Cut profile API.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('cut-avatars','cut-avatars',true,5242880,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif'];

drop policy if exists "public read cut avatars" on storage.objects;
create policy "public read cut avatars" on storage.objects for select using (bucket_id='cut-avatars');
drop policy if exists "users upload own cut avatars" on storage.objects;
create policy "users upload own cut avatars" on storage.objects for insert to authenticated with check (bucket_id='cut-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "users update own cut avatars" on storage.objects;
create policy "users update own cut avatars" on storage.objects for update to authenticated using (bucket_id='cut-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "users delete own cut avatars" on storage.objects;
create policy "users delete own cut avatars" on storage.objects for delete to authenticated using (bucket_id='cut-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
