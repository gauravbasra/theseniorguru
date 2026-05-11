create unique index if not exists ad_impressions_request_dedupe_idx
  on public.ad_impressions (placement_key, request_id, coalesce(ad_creative_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where request_id is not null;

create unique index if not exists ad_clicks_request_dedupe_idx
  on public.ad_clicks (placement_key, request_id, coalesce(ad_creative_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where request_id is not null;
