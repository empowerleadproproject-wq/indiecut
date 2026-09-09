create extension if not exists pgcrypto;

create table if not exists public.artists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'artist',
  bio text,
  image_url text,
  website_url text,
  instagram_url text,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.media_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  media_type text not null default 'music',
  artist_name text,
  description text,
  media_url text not null,
  cover_url text,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.artists enable row level security;
alter table public.media_items enable row level security;

drop policy if exists "public read artists" on public.artists;
create policy "public read artists" on public.artists for select using (true);

drop policy if exists "public read media items" on public.media_items;
create policy "public read media items" on public.media_items for select using (true);

update public.site_settings
set setting_value='{"enabled":true,"default_topic":"trending entertainment stories involving Black culture, film, television, music, celebrities and independent creators","default_count":3,"focus":"verified entertainment news","require_multiple_sources":true,"reject_rumors":true}', updated_at=now()
where setting_key='content_agent_config';
