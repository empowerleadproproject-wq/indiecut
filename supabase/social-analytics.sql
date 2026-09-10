create table if not exists public.social_analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  captured_at timestamptz not null default now(),
  platform text not null default 'instagram',
  account_id text,
  account_name text,
  followers bigint,
  following bigint,
  media_count bigint,
  reach bigint,
  profile_views bigint,
  website_clicks bigint,
  recent_posts integer,
  recent_likes bigint,
  recent_comments bigint,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists social_analytics_snapshots_platform_captured_at_idx
  on public.social_analytics_snapshots(platform, captured_at desc);

create index if not exists social_analytics_snapshots_account_id_captured_at_idx
  on public.social_analytics_snapshots(account_id, captured_at desc);

alter table public.social_analytics_snapshots enable row level security;

-- Analytics are written/read server-side with the Supabase service role.
-- No public policies are created intentionally.
