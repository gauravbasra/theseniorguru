# TSG Shared Platform API & Database Contract

## Purpose

This contract keeps the Flutter mobile app, Node.js mobile API, and Laravel business portal on one PostgreSQL source of truth.

## Runtime Boundaries

Mobile app:

- Flutter client for seniors, trusted-circle members, Guru companion flows, SOS, location, health tracking, wearable/device permission surfaces.

Node.js API:

- Mobile APIs.
- Guru intelligence and orchestration.
- AI routing.
- Weather, location, health, wearable, and realtime ingestion.
- Risk scoring and explanation generation.

Laravel business portal:

- Business login and access approval.
- Listings, services, bookings, requests, resident command center, reports, billing, staff management.
- Operational review of shared data.

Shared PostgreSQL:

- Single source of truth for users, residents, businesses, services, bookings, alerts, vitals, devices, permissions, Guru risk scores, and audit trails.

## Canonical Database

Current shared database metadata verified from Vercel:

- Vercel project: `mobile-api`
- Engine: PostgreSQL
- Provider: Neon
- Database: `neondb`
- Host family: `*.neon.tech`

The Laravel portal must be migrated to this database contract. A separate Laravel-only database is temporary and should fail the shared database audit.

## Required Shared Tables

Laravel must expect these shared tables to exist:

- `users`
- `residents`
- `businesses`
- `services`
- `bookings`
- `business_approval_queue`
- `service_requests`
- `support_orders`
- `health_daily_metrics`
- `health_vitals`
- `guru_risk_scores`
- `wearable_devices`
- `audit_logs`

## Ownership

Node-owned intelligence tables:

- `guru_risk_scores`
- `guru_health_insights`
- `guru_recommendations`
- `health_daily_metrics`
- `health_realtime_events`
- `wearable_telemetry`
- `safety_events`
- `transportation_context_decisions`

Laravel operations tables:

- `businesses`
- `services`
- `bookings`
- `business_approval_queue`
- `business_leads`
- `business_photos`
- `business_documents`
- `service_requests`
- `support_orders`
- `senior_living_communities`
- `senior_living_care_levels`
- `senior_living_resident_assignments`
- `senior_living_resident_import_batches`
- `audit_logs`

`service_requests` is the Laravel-facing contract relation. In the current shared Neon database it is a view over `support_orders`, so Laravel gets the stable operations name without duplicating or moving Node/mobile support-order logic.

Shared identity and access tables:

- `users`
- `business_approvals`
- `consent_records`
- `health_sharing_permissions`
- `device_permission_grants`

## Critical Rules

1. Laravel must not calculate or overwrite Guru risk scores.
2. Laravel must not maintain a separate resident, booking, service, alert, device, or vitals model that diverges from Node/mobile.
3. Node owns realtime ingestion and AI orchestration.
4. Laravel owns operations workflow, review, reporting, approvals, and back-office actions.
5. Schema changes to shared tables require updating this contract and the Node/Laravel adapters together.
6. Temporary portal-only tables must be removed from production before the portal is considered fully shared-platform aligned.

## Temporary Tables To Retire

These Laravel prototype tables are not part of the shared platform contract:

- `communities`
- `community_services`
- `family_contacts`
- `resident_alerts`
- `vital_readings`
- `devices`
- `staff_shifts`

They can remain in local/test migrations while the UI is being adapted, but production should connect to shared tables instead.

## Laravel Verification

Run:

```bash
php artisan tsg:audit-shared-database
```

Passing means:

- The configured database is PostgreSQL.
- Required shared tables/views exist.
- Node-owned tables are visible for read-only operational views.

Warnings mean:

- Temporary Laravel-only tables were detected.
- The portal may still be using an interim schema.

Failure means:

- Required shared tables are missing.
- The portal is not connected to the shared PostgreSQL contract.

## Senior-Living Onboarding Contract

Laravel owns the operations process for onboarding a senior-living community, but it writes users and residents into the shared platform tables.

Tables:

- `senior_living_communities`: one real community/facility being onboarded.
- `senior_living_care_levels`: supported care levels and target resident counts.
- `senior_living_resident_import_batches`: validation and import process record.
- `senior_living_resident_assignments`: link between shared `residents`, community, and care level.

Initial production onboarding target:

- `memory_care`: 50 residents.
- `independent_living`: 50 residents.
- `assisted_living`: 50 residents.

API endpoints:

- `POST /portal-api/business/onboarding/senior-living-communities`
- `GET /portal-api/business/onboarding/senior-living-communities/{community}`
- `POST /portal-api/business/onboarding/senior-living-communities/{community}/resident-imports`

Import rules:

1. A community must declare exactly `memory_care`, `independent_living`, and `assisted_living`.
2. Each care level must have a positive target count.
3. Resident import counts must exactly match the care-level targets.
4. Imports run inside a database transaction.
5. Every resident creates a shared `users` row with role `senior`, a shared `residents` row, and a `senior_living_resident_assignments` row.
6. The import endpoint must not generate residents itself. It only persists submitted resident rows.
7. Test/smoke data must be removed after verification.
