create table if not exists public.senior_living_communities (
    id uuid primary key default gen_random_uuid(),
    business_id uuid null references public.businesses(id) on delete set null,
    name text not null,
    address text null,
    status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
    target_resident_count integer not null check (target_resident_count > 0),
    onboarding_metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.senior_living_care_levels (
    id uuid primary key default gen_random_uuid(),
    community_id uuid not null references public.senior_living_communities(id) on delete cascade,
    code text not null check (code in ('assisted_living', 'independent_living', 'memory_care')),
    display_name text not null,
    target_resident_count integer not null check (target_resident_count > 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (community_id, code)
);

create table if not exists public.senior_living_resident_import_batches (
    id uuid primary key default gen_random_uuid(),
    community_id uuid not null references public.senior_living_communities(id) on delete cascade,
    status text not null default 'pending' check (status in ('pending', 'processing', 'committed', 'failed')),
    expected_resident_count integer not null check (expected_resident_count > 0),
    accepted_count integer not null default 0 check (accepted_count >= 0),
    rejected_count integer not null default 0 check (rejected_count >= 0),
    idempotency_key text null unique,
    validation_report jsonb not null default '{}'::jsonb,
    submitted_by_laravel_user_id text null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.senior_living_resident_assignments (
    id uuid primary key default gen_random_uuid(),
    community_id uuid not null references public.senior_living_communities(id) on delete cascade,
    care_level_id uuid not null references public.senior_living_care_levels(id) on delete restrict,
    resident_id uuid not null references public.residents(id) on delete cascade,
    import_batch_id uuid null references public.senior_living_resident_import_batches(id) on delete set null,
    room_number text null,
    external_reference text null,
    status text not null default 'active' check (status in ('active', 'transferred', 'discharged', 'archived')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (community_id, resident_id),
    unique (community_id, room_number)
);

create index if not exists senior_living_care_levels_community_idx
    on public.senior_living_care_levels (community_id);

create index if not exists senior_living_resident_assignments_community_idx
    on public.senior_living_resident_assignments (community_id, status);

create index if not exists senior_living_resident_assignments_care_level_idx
    on public.senior_living_resident_assignments (care_level_id, status);
