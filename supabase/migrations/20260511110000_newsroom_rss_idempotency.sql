create unique index if not exists news_items_source_url_dedupe_idx
  on public.news_items (lower(source_url))
  where source_url is not null;

create index if not exists news_items_source_title_idx
  on public.news_items (source_name, title, created_at desc);
