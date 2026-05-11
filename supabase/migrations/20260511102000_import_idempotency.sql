alter table public.import_batches
  add column if not exists skipped_records integer not null default 0;

create index if not exists extracted_entities_source_record_review_idx
  on public.extracted_entities (source_record_id, review_status)
  where source_record_id is not null;
