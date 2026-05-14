create table if not exists public.extracted_entity_review_assignments (
  id uuid primary key default gen_random_uuid(),
  extracted_entity_id uuid not null references public.extracted_entities(id) on delete cascade,
  route text not null check (
    route in ('approve_ready', 'human_review', 'legal_review', 'image_rights_review', 'duplicate_review')
  ),
  status text not null default 'assigned' check (
    status in ('assigned', 'in_review', 'completed', 'escalated')
  ),
  assigned_to text not null,
  assigned_by text,
  due_at timestamptz not null,
  notes text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.extracted_entity_review_assignments enable row level security;

create index if not exists extracted_entity_review_assignments_entity_idx
  on public.extracted_entity_review_assignments (extracted_entity_id, created_at desc);

create index if not exists extracted_entity_review_assignments_status_due_idx
  on public.extracted_entity_review_assignments (status, due_at);
