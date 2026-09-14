create table if not exists public.crm_press_releases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  contact_id uuid references public.crm_contacts(id) on delete set null,
  artist_name text not null,
  release_title text not null,
  release_type text not null default 'single',
  release_date date,
  genre text,
  city text,
  country text not null default 'United States',
  music_url text,
  artwork_url text,
  youtube_url text,
  artist_website text,
  media_contact_name text,
  media_contact_email text,
  key_facts text,
  article_headline text,
  article_subheadline text,
  article_body text,
  article_id uuid references public.articles(id) on delete set null,
  press_title text,
  press_summary text,
  press_content text,
  press_categories jsonb not null default '["Arts & Entertainment"]'::jsonb,
  distribution_plan text not null default 'free',
  provider text not null default 'prnow',
  provider_release_id text,
  provider_slug_id text,
  provider_status text,
  provider_status_reason text,
  provider_report jsonb,
  provider_links jsonb not null default '[]'::jsonb,
  provider_response jsonb,
  status text not null default 'draft' check (status in ('draft','generated','article_published','submitted','distributed','rejected','refunded')),
  submitted_at timestamptz,
  distributed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_press_releases_contact_id_idx on public.crm_press_releases(contact_id);
create index if not exists crm_press_releases_status_idx on public.crm_press_releases(status);
create index if not exists crm_press_releases_provider_status_idx on public.crm_press_releases(provider_status);
create index if not exists crm_press_releases_organization_id_idx on public.crm_press_releases(organization_id);

alter table public.crm_press_releases enable row level security;

comment on column public.crm_press_releases.organization_id is 'Reserved for multi-tenant artist workspaces; service-role admin routes own access until workspace RLS is introduced.';
comment on table public.crm_press_releases is 'Artist CRM press release drafts, Indie Cut article placements, and third-party distribution tracking.';
