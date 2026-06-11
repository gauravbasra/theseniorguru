create table if not exists public.tenants (
    id uuid primary key default gen_random_uuid(),
    business_id uuid null references public.businesses(id) on delete set null,
    name text not null,
    tenant_type text not null check (tenant_type in ('community','provider','day_care','home_care','insurance','platform')),
    status text not null default 'active' check (status in ('active','pending','suspended','archived')),
    settings jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.tenant_locations (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    senior_living_community_id uuid null references public.senior_living_communities(id) on delete set null,
    name text not null,
    address_line1 text null,
    city text null,
    state text null,
    postal_code text null,
    latitude numeric null,
    longitude numeric null,
    timezone text not null default 'America/Denver',
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.roles (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    guard_name text not null default 'web',
    description text null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.permissions (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    guard_name text not null default 'web',
    description text null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.model_has_roles (
    role_id uuid not null references public.roles(id) on delete cascade,
    model_type text not null,
    model_id uuid not null,
    tenant_id uuid null references public.tenants(id) on delete cascade,
    primary key (role_id, model_type, model_id, tenant_id)
);

create table if not exists public.role_has_permissions (
    role_id uuid not null references public.roles(id) on delete cascade,
    permission_id uuid not null references public.permissions(id) on delete cascade,
    primary key (role_id, permission_id)
);

create table if not exists public.tenant_user_memberships (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    location_id uuid null references public.tenant_locations(id) on delete cascade,
    user_id uuid not null references public.users(id) on delete cascade,
    role_name text not null,
    status text not null default 'active' check (status in ('active','invited','suspended','removed')),
    can_view_health boolean not null default false,
    can_view_billing boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (tenant_id, location_id, user_id)
);

create table if not exists public.tenant_location_resident_assignments (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    location_id uuid null references public.tenant_locations(id) on delete cascade,
    resident_id uuid not null references public.residents(id) on delete cascade,
    care_level text null check (care_level is null or care_level in ('assisted_living','independent_living','memory_care','adult_day_care','home_care')),
    room_number text null,
    status text not null default 'active' check (status in ('active','transferred','discharged','archived')),
    consent_status text not null default 'pending' check (consent_status in ('pending','granted','revoked','contractual')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (tenant_id, resident_id)
);

create table if not exists public.staff_profiles (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    location_id uuid null references public.tenant_locations(id) on delete set null,
    user_id uuid null references public.users(id) on delete set null,
    display_name text not null,
    department text null,
    role_name text not null,
    status text not null default 'active' check (status in ('active','inactive','on_leave')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.staff_assignments (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    location_id uuid null references public.tenant_locations(id) on delete cascade,
    staff_profile_id uuid null references public.staff_profiles(id) on delete set null,
    resident_id uuid null references public.residents(id) on delete cascade,
    assignment_type text not null,
    status text not null default 'active' check (status in ('active','completed','cancelled')),
    due_at timestamptz null,
    completed_at timestamptz null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.staff_tasks (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    location_id uuid null references public.tenant_locations(id) on delete cascade,
    resident_id uuid null references public.residents(id) on delete cascade,
    assigned_to uuid null references public.staff_profiles(id) on delete set null,
    source_type text not null,
    source_id uuid null,
    priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
    title text not null,
    body text null,
    status text not null default 'open' check (status in ('open','accepted','snoozed','resolved','cancelled')),
    due_at timestamptz null,
    resolved_at timestamptz null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.alert_triage_events (
    id uuid primary key default gen_random_uuid(),
    alert_id uuid not null,
    tenant_id uuid null references public.tenants(id) on delete set null,
    location_id uuid null references public.tenant_locations(id) on delete set null,
    actor_user_id uuid null,
    action text not null check (action in ('acknowledge','assign','escalate','resolve','convert_to_incident','comment')),
    assigned_to uuid null,
    note text null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists public.incidents (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid null references public.tenants(id) on delete set null,
    location_id uuid null references public.tenant_locations(id) on delete set null,
    resident_id uuid null references public.residents(id) on delete set null,
    source_alert_id uuid null,
    incident_type text not null,
    severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
    title text not null,
    narrative text null,
    status text not null default 'open' check (status in ('open','investigating','family_notified','resolved','closed')),
    family_notified_at timestamptz null,
    resolved_at timestamptz null,
    created_by uuid null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.incident_events (
    id uuid primary key default gen_random_uuid(),
    incident_id uuid not null references public.incidents(id) on delete cascade,
    actor_user_id uuid null,
    event_type text not null,
    body text null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists public.resident_events (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid null references public.tenants(id) on delete set null,
    location_id uuid null references public.tenant_locations(id) on delete set null,
    resident_id uuid not null references public.residents(id) on delete cascade,
    event_type text not null,
    source_table text null,
    source_id uuid null,
    title text not null,
    body text null,
    occurred_at timestamptz not null default now(),
    actor_user_id uuid null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists public.medication_schedules (
    id uuid primary key default gen_random_uuid(),
    medication_id uuid not null references public.medications(id) on delete cascade,
    resident_id uuid not null references public.residents(id) on delete cascade,
    schedule_label text not null,
    local_time time null,
    days_of_week integer[] not null default array[0,1,2,3,4,5,6],
    status text not null default 'active' check (status in ('active','paused','archived')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.medication_events (
    id uuid primary key default gen_random_uuid(),
    medication_id uuid null references public.medications(id) on delete set null,
    resident_id uuid not null references public.residents(id) on delete cascade,
    schedule_id uuid null references public.medication_schedules(id) on delete set null,
    event_type text not null check (event_type in ('taken','missed','skipped','late','refill_requested','refill_completed')),
    source text not null default 'business_portal',
    occurred_at timestamptz not null default now(),
    actor_user_id uuid null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists public.service_matches (
    id uuid primary key default gen_random_uuid(),
    service_request_id uuid not null,
    provider_business_id uuid not null references public.businesses(id) on delete cascade,
    provider_service_id uuid null,
    match_score numeric not null default 0,
    distance_miles numeric null,
    match_reasons jsonb not null default '[]'::jsonb,
    status text not null default 'recommended' check (status in ('recommended','offered','accepted','declined','expired')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (service_request_id, provider_business_id, provider_service_id)
);

create table if not exists public.booking_events (
    id uuid primary key default gen_random_uuid(),
    booking_id uuid not null references public.bookings(id) on delete cascade,
    actor_user_id uuid null,
    event_type text not null,
    from_status text null,
    to_status text null,
    body text null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists public.conversations (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid null references public.tenants(id) on delete set null,
    location_id uuid null references public.tenant_locations(id) on delete set null,
    resident_id uuid null references public.residents(id) on delete set null,
    conversation_type text not null default 'care_coordination',
    subject text null,
    status text not null default 'open' check (status in ('open','closed','archived')),
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references public.conversations(id) on delete cascade,
    sender_user_id uuid null,
    sender_role text null,
    body text not null,
    sensitivity text not null default 'normal' check (sensitivity in ('normal','care_note','health_sensitive')),
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists public.notification_rules (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    location_id uuid null references public.tenant_locations(id) on delete cascade,
    event_type text not null,
    channel text not null,
    severity_threshold text null,
    quiet_hours jsonb not null default '{}'::jsonb,
    enabled boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.notification_logs (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid null references public.tenants(id) on delete set null,
    recipient_user_id uuid null references public.users(id) on delete set null,
    channel text not null,
    event_type text not null,
    status text not null default 'queued',
    provider text null,
    provider_message_id text null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    sent_at timestamptz null,
    delivered_at timestamptz null
);

create table if not exists public.broadcasts (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    location_id uuid null references public.tenant_locations(id) on delete cascade,
    title text not null,
    body text not null,
    audience text not null default 'families',
    status text not null default 'draft' check (status in ('draft','scheduled','sent','cancelled')),
    scheduled_at timestamptz null,
    sent_at timestamptz null,
    created_by uuid null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.analytics_snapshots (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid null references public.tenants(id) on delete cascade,
    location_id uuid null references public.tenant_locations(id) on delete cascade,
    snapshot_type text not null,
    period_start date not null,
    period_end date not null,
    metrics jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    unique (tenant_id, location_id, snapshot_type, period_start, period_end)
);

create table if not exists public.report_definitions (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid null references public.tenants(id) on delete cascade,
    name text not null,
    report_type text not null,
    schedule jsonb not null default '{}'::jsonb,
    filters jsonb not null default '{}'::jsonb,
    enabled boolean not null default true,
    created_by uuid null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.generated_reports (
    id uuid primary key default gen_random_uuid(),
    report_definition_id uuid null references public.report_definitions(id) on delete set null,
    tenant_id uuid null references public.tenants(id) on delete cascade,
    report_type text not null,
    status text not null default 'queued' check (status in ('queued','processing','ready','failed')),
    format text not null default 'csv' check (format in ('csv','pdf','xlsx')),
    storage_url text null,
    generated_by uuid null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    completed_at timestamptz null
);

create table if not exists public.exports (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid null references public.tenants(id) on delete cascade,
    export_type text not null,
    status text not null default 'queued' check (status in ('queued','processing','ready','failed')),
    format text not null default 'csv',
    storage_url text null,
    requested_by uuid null,
    filters jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    completed_at timestamptz null
);

create or replace view public.providers as
select
    id,
    owner_user_id,
    name,
    contact_person,
    email,
    phone,
    website,
    description,
    status,
    onboarding_complete,
    created_at,
    updated_at
from public.businesses;

create or replace view public.provider_services as
select
    id,
    business_profile_id as provider_id,
    category,
    service_name as name,
    description,
    price_min,
    price_max,
    price_unit,
    cancellation_policy,
    minimum_notice_minutes,
    active,
    created_at
from public.business_service_catalog;

create or replace view public.provider_service_areas as
select
    id,
    business_profile_id as provider_id,
    null::uuid as service_id,
    case
        when boundary_geojson is not null then 'polygon'
        when coalesce(array_length(zip_codes, 1), 0) > 0 then 'zip_codes'
        else 'radius'
    end as area_type,
    null::numeric as base_latitude,
    null::numeric as base_longitude,
    service_radius_miles as radius_miles,
    coalesce(to_jsonb(zip_codes), '[]'::jsonb) as zip_codes,
    boundary_geojson as polygon_geojson,
    coalesce(excluded_areas_geojson, '[]'::jsonb) as excluded_geojson,
    active,
    created_at,
    null::timestamptz as updated_at
from public.business_service_areas;

create index if not exists tenants_business_idx on public.tenants (business_id);
create index if not exists tenant_locations_tenant_idx on public.tenant_locations (tenant_id);
create index if not exists tenant_resident_assignments_tenant_idx on public.tenant_location_resident_assignments (tenant_id, location_id, status);
create index if not exists staff_tasks_tenant_status_idx on public.staff_tasks (tenant_id, status, priority);
create index if not exists alert_triage_events_alert_idx on public.alert_triage_events (alert_id, created_at desc);
create index if not exists incidents_tenant_status_idx on public.incidents (tenant_id, location_id, status, severity);
create index if not exists resident_events_resident_idx on public.resident_events (resident_id, occurred_at desc);
create index if not exists medication_events_resident_idx on public.medication_events (resident_id, occurred_at desc);
create index if not exists service_matches_request_idx on public.service_matches (service_request_id, match_score desc);
create index if not exists booking_events_booking_idx on public.booking_events (booking_id, created_at desc);
