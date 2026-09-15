create table if not exists public.watch_viewers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists watch_viewers_created_at_idx on public.watch_viewers(created_at desc);
alter table public.watch_viewers enable row level security;
