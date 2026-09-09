create extension if not exists pgcrypto;

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  headline text not null,
  slug text not null unique,
  subheadline text,
  category text not null default 'culture',
  subject_name text,
  body text,
  featured_media_url text,
  author_name text,
  sources jsonb not null default '[]'::jsonb,
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected')),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique,
  setting_value text,
  updated_at timestamptz not null default now()
);

alter table public.articles enable row level security;
alter table public.site_settings enable row level security;

drop policy if exists "public read verified published articles" on public.articles;
create policy "public read verified published articles" on public.articles for select using(status='published' and verification_status='verified');

insert into public.site_settings(setting_key,setting_value) values
('content_agent_config','{"enabled":false,"default_topic":"trending entertainment stories involving Black culture, film, television, music, celebrities and independent creators","default_count":3,"focus":"verified entertainment news","require_multiple_sources":true,"reject_rumors":true}')
on conflict(setting_key) do nothing;
