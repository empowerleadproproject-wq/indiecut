alter table public.articles
  add column if not exists lead_video_url text;

alter table public.articles
  add column if not exists lead_video_source_url text;
