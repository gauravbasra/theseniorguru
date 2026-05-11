insert into public.data_sources (
  name,
  source_type,
  base_url,
  jurisdiction,
  review_status,
  robots_status,
  terms_notes,
  approved_at
)
select
  'TheSeniorGuru.com current public listing index',
  'manual',
  'https://theseniorguru.com/search',
  'US',
  'approved'::public.source_review_status,
  'allowed',
  'Owner-controlled public listing index. Images are staged as source metadata pending storage and reuse review.',
  '2026-05-11T00:00:00.000Z'::timestamptz
where not exists (
  select 1
  from public.data_sources
  where base_url = 'https://theseniorguru.com/search'
);
