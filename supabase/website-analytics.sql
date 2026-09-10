create extension if not exists pgcrypto;

create table if not exists public.website_analytics_events (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  session_id text not null,
  event_type text not null default 'page_view',
  path text not null,
  page_title text,
  referrer text,
  article_slug text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists website_analytics_events_created_at_idx on public.website_analytics_events(created_at desc);
create index if not exists website_analytics_events_path_created_at_idx on public.website_analytics_events(path, created_at desc);
create index if not exists website_analytics_events_visitor_created_at_idx on public.website_analytics_events(visitor_id, created_at desc);
create index if not exists website_analytics_events_session_created_at_idx on public.website_analytics_events(session_id, created_at desc);

alter table public.website_analytics_events enable row level security;
