# TheSeniorGuru Business Portal

Laravel operations console for `business.theseniorguru.com`.

## Platform Split

- Mobile app: Flutter
- Mobile/API intelligence layer: Node.js at `mobile-api`
- Business portal: Laravel at `business.theseniorguru.com`
- Database: shared PostgreSQL, currently the Neon `neondb` database attached to `mobile-api`

Laravel is the operations console. Node remains the orchestration and intelligence layer for Guru risk scoring, health ingestion, wearable/device flows, realtime mobile behavior, and AI routing.

## Shared Database Rule

Do not create a second source of truth for residents, alerts, bookings, services, vitals, devices, permissions, or Guru risk scores.

Laravel should read operational records from shared tables such as:

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

Laravel must not reimplement Guru risk scoring. It reads `guru_risk_scores`, `guru_health_insights`, and related Node-owned tables.

## Verification

Run:

```bash
php artisan tsg:audit-shared-database
```

Expected production result:

- Engine is `pgsql`
- Database is the shared Neon database used by `mobile-api`
- Required shared tables are present
- Shared views such as `service_requests` are present when they are the contract layer over physical tables
- Temporary portal-only tables are not present

If temporary tables such as `communities`, `community_services`, `resident_alerts`, `vital_readings`, `devices`, or `staff_shifts` appear, the portal is still on the interim Laravel-only schema and should not be treated as fully aligned.

## Business Onboarding APIs

Session-authenticated Laravel endpoints write to the shared PostgreSQL database through `TSG_SHARED_DATABASE_URL`.

- `POST /portal-api/business/onboarding/senior-living-communities`
- `GET /portal-api/business/onboarding/senior-living-communities/{community}`
- `POST /portal-api/business/onboarding/senior-living-communities/{community}/resident-imports`
- `GET /portal-api/business/onboarding/diagnostics`

The resident import endpoint validates resident counts against the community care-level targets before committing. For the initial senior-living onboarding, the expected structure is 50 memory-care residents, 50 independent-living residents, and 50 assisted-living residents.

## Contract

See [docs/TSG_SHARED_PLATFORM_API_DATABASE_CONTRACT.md](docs/TSG_SHARED_PLATFORM_API_DATABASE_CONTRACT.md).
