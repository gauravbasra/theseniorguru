# Guru Companion Phase 2 — Camera Scan + Matching Foundation

This package builds on Phase 1 and adds the first real scan-enabled Guru Companion layer.

## Mobile app changes

Updated `apps/mobile/App.tsx`:

- Added `expo-image-picker` integration.
- Added camera permission request.
- Added photo library permission request.
- Expanded the floating Guru widget with scan modes:
  - Product scan
  - Medicine scan
  - Document scan
  - QR scan
  - AR helper scene capture
- Added image preview inside Guru chat bubbles.
- Added scan result cards inside the widget.
- Added senior-safe warnings for medicine and QR scan flows.
- Added backend calls:
  - `POST /api/guru/scan-intents`
  - `POST /api/guru/scans`
  - `GET /api/guru/scans`
  - `POST /api/guru/scan-matches`

Updated `apps/mobile/package.json`:

- Added `expo-image-picker`.

Updated `apps/mobile/app.json`:

- Added iOS camera/photo/microphone usage descriptions.
- Added Android camera/photo/audio permissions.
- Added Expo image picker plugin.

## Backend changes

Updated JSON demo backend `apps/mobile-api/server.js`:

- Added scan analysis logic.
- Added scan category inference.
- Added service matching from scan type.
- Persisted scan objects in demo state.
- Added conversation events for scans.

Updated production backend `apps/mobile-api/production-server.js`:

- Added production endpoints for scan capture, scan history, and scan-based service matching.
- Writes scan records to PostgreSQL.
- Writes scan events to Guru conversation history.
- Audits scan activity.

## Database changes

Added migration:

`apps/mobile-api/migrations/002_guru_companion_phase2_scans.sql`

Creates:

- `guru_scans`
- indexes for resident scan history and scan type
- additional metadata columns on `guru_scan_intents`

Also updated `apps/mobile-api/schema.sql` with the `guru_scans` table for fresh local/demo installs.

## What works now

The UI now has real scan entry points and device camera/photo selection hooks. On scan capture, the app sends scan metadata to the backend and receives a structured analysis object with recommended actions and matched services.

The current implementation intentionally does not upload raw image bytes to cloud storage yet. It sends local image URI metadata and prepares the backend contract. Production image upload should be added in Phase 3 using signed upload URLs and object storage.

## Phase 3 recommendation

Add:

- signed upload URL endpoint
- Supabase Storage / S3 image storage
- OpenAI vision / Gemini vision analysis
- OCR extraction
- medication label parsing
- QR resolver safety checks
- AR overlay prototype
- trusted-circle share flow
