alter table if exists public.media_items
  add column if not exists ad_break_mode text not null default 'none',
  add column if not exists ad_break_interval_minutes integer,
  add column if not exists custom_ad_breaks text;
