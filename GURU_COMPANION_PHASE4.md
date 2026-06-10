# Guru Companion Phase 4 — Health, Wearables, Fall Detection, AR Helper

This package builds on Phase 3 and adds a runnable Phase 4 source implementation for the mobile app and JSON demo backend.

## Mobile additions

The resident-facing floating Guru widget now includes a **Health + Safety Copilot** panel with:

- Native HealthKit / Health Connect sync button
- Wearable sync button
- Fall detection simulation button
- Away / safe-zone risk simulation button
- AR guidance entry point
- Guru chat intent routing for phrases such as “health,” “watch,” “wearable,” and “fall detection”

The app already had HealthKit, Health Connect, sensors, location, camera, and notification packages in `apps/mobile/package.json` and native permission text in `app.json`. Phase 4 connects those existing services to the Guru widget.

## Backend additions

New JSON demo API routes in `apps/mobile-api/server.js`:

- `GET /api/guru/phase4`
- `POST /api/guru/health-insights`
- `POST /api/guru/wearable-status`
- `POST /api/guru/safety-copilot`
- `POST /api/guru/ar-guidance`

New migration:

- `apps/mobile-api/migrations/004_guru_companion_phase4_health_wearables_ar.sql`

## Important runtime note

This is a **source package**, not a signed APK build. I verified backend JavaScript syntax with `node --check`. I could not run a full Expo/Android build in this environment because the React Native dependencies and Android build cache are not installed here.

## How to test locally

```bash
cd apps/mobile-api
npm install
npm start
```

Then in another terminal:

```bash
cd apps/mobile
npm install
EXPO_PUBLIC_API_BASE_URL=http://localhost:4187 npm start
```

Open the resident app, tap the floating Guru button, then tap **Health**.

## Phase 4 workflow coverage

- Health sync tries native APIs first through `collectNativeHealthReadings()`.
- If native APIs are unavailable, the existing demo vitals sync path remains usable.
- Wearable sync uses the existing `syncWearableTelemetry()` scenarios.
- Fall simulation calls the existing `simulateSafetyEvent("fall")` workflow and surfaces the result through Guru.
- AR guidance creates a backend AR session and opens the AR scan capture path.
